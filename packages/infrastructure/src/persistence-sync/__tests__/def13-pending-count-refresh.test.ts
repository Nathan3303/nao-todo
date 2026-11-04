// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { makeTaskVO } from '../../persistence-local/__tests__/local-repos-test-helpers'
import { localDatabase } from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import { setup } from '../../persistence-local/__tests__/local-repos-test-helpers'
import { syncStatus } from '../sync-status'
import { syncTracker } from '../sync-tracker'
import { SyncService } from '../sync-service'

/**
 * DEF-13 —— 同步「待推送 N」数字滞后
 *
 * 现状：`pendingCount` 只在**一次运行结束**时落定（`finishRun` → `endRun`）⇒ 运行结束之后新产生的
 * 编辑（`markDirty` 入队）要等下一轮同步跑完才更新，离线/暂停态下长时间显示旧数字。
 *
 * 期望（本次修复口径）：
 * - 入队侧事件（`syncTracker` dirty 监听 ⇒ `syncService.schedulePush`）后 **~400ms 防抖**重读队列，
 *   由 `syncStatus.settlePendingCount` **补充落定**（**不是运行边界**，不入 `enqueue`）；
 * - **连续入队只刷新一次**（防抖合并）；
 * - ⛔ 刷新**不得**触发任何网络/同步（只用 spy 断言 `pushAll` / `post` 调用 0 次）；
 * - 运行结束时仍由 `finishRun` 落定（同源同值）⇒ 同步跑完回 0。
 *
 * 反证（红基线）：去掉 `schedulePush` 里的 `schedulePendingCountSettle()` 调用 ⇒ ①② 必红。
 */

const USER_ID = 'def13-user'
/** 防抖上界（生产 400ms）+ 采样余量 */
const SETTLE_WAIT_MS = 650

/** 推送全确认（echo results）：一次运行 ⇒ 脏队列清空 */
const echoResultsRequester = (): Requester =>
    ({
        post: async (url: string, body: unknown) => {
            if (url === '/sync/pull') return { data: { data: {} }, serverTime: Date.now() }
            const payload = body as Record<string, unknown>
            const rows = Object.entries(payload).filter(([key]) => key !== 'deletions')
            const results = rows.flatMap(([table, value]) =>
                (value as { id: string }[]).map((row) => ({ table, id: row.id }))
            )
            const deletions = (payload.deletions as { table: string; id: string }[]) ?? []
            return {
                data: {
                    data: {
                        results: [
                            ...results,
                            ...deletions.map((item) => ({ table: item.table, id: item.id }))
                        ]
                    },
                    serverTime: Date.now()
                }
            }
        },
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    }) as unknown as Requester

/**
 * 定时器回收（同 `local-first-dirty-scope.test.ts`）
 * @description 生产防抖用一个一次性 `setTimeout`（本用例只推进到刷新点，2s 推送定时器仍在）⇒
 *              用例结束即清掉本用例创建的定时器，避免跨用例触发 pushAll。
 */
const timersCreatedInTest = new Set<ReturnType<typeof globalThis.setTimeout>>()
let realSetTimeout: typeof globalThis.setTimeout

const wait = (ms: number): Promise<void> => new Promise((resolve) => realSetTimeout(resolve, ms))

beforeEach(async () => {
    realSetTimeout = globalThis.setTimeout
    const trackingSetTimeout = (...args: Parameters<typeof globalThis.setTimeout>) => {
        const id = realSetTimeout(...args)
        timersCreatedInTest.add(id)
        return id
    }
    globalThis.setTimeout = trackingSetTimeout as typeof globalThis.setTimeout

    await setup(USER_ID)
    // T590 AC6：新不变量「无 token ⇒ 不发请求」，夹具显式置 token
    localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-def13-fixture')
    await localDatabase.syncQueue.clear()
    await localDatabase.syncCursor.clear()
    // 单例状态复位（消除其他用例的残留计数；不触碰运行边界字段）
    syncStatus.settlePendingCount(0)
    syncStatus.clearPaused()
})

afterEach(() => {
    for (const id of timersCreatedInTest) clearTimeout(id)
    timersCreatedInTest.clear()
    globalThis.setTimeout = realSetTimeout
    syncTracker.setDirtyListener(() => {})
    syncStatus.clearPaused()
    vi.restoreAllMocks()
})

/** 装配层同款接线：dirty ⇒ schedulePush（web `data-plane.ts` / desktop `AppRoot.vue`） */
const wireDirtyToPush = (service: SyncService): void => {
    syncTracker.setDirtyListener(() => {
        service.schedulePush()
    })
}

describe('DEF-13 待推送数在入队侧补充落定', () => {
    it('① 离线暂停态入队若干次 ⇒ 防抖后 pendingCount = 实际 dirty 数（且不触发同步/网络）', async () => {
        const requester = echoResultsRequester()
        const post = vi.spyOn(requester, 'post')
        const service = new SyncService(requester)
        const pushAll = vi.spyOn(service, 'pushAll')
        wireDirtyToPush(service)
        // 离线 ⇒ 同步暂停态（不计入运行；仅证明该路径与运行无关）
        syncStatus.setPaused('offline')
        const syncingBefore = syncStatus.get().syncing

        await syncTracker.markDirty('tasks', 't-1', 'upsert', '2026-11-04T00:00:00.000Z')
        await syncTracker.markDirty('tasks', 't-2', 'upsert', '2026-11-04T00:00:00.000Z')
        await syncTracker.markDirty('projects', 'p-1', 'upsert', '2026-11-04T00:00:00.000Z')
        // 入队后立刻：仍是旧数字（防抖未到期）
        expect(syncStatus.get().pendingCount).toBe(0)

        await wait(SETTLE_WAIT_MS)

        expect(syncStatus.get().pendingCount).toBe(await syncTracker.countDirty(USER_ID))
        expect(syncStatus.get().pendingCount).toBe(3)
        // ⛔ 刷新不是运行边界：不触发同步、不发请求、不进运行态、不改暂停态
        expect(pushAll).not.toHaveBeenCalled()
        expect(post).not.toHaveBeenCalled()
        expect(syncStatus.get().syncing).toBe(syncingBefore)
        expect(syncStatus.get().paused).toBe(true)
        expect(syncStatus.get().pausedReason).toBe('offline')
    })

    it('① 连续入队只刷新 1 次（防抖合并）', async () => {
        const service = new SyncService(echoResultsRequester())
        wireDirtyToPush(service)
        syncStatus.setPaused('offline')
        const countDirty = vi.spyOn(syncTracker, 'countDirty')

        for (let i = 1; i <= 3; i++) {
            await syncTracker.markDirty('tasks', `t-${i}`, 'upsert', '2026-11-04T00:00:00.000Z')
            await wait(100)
        }
        await wait(SETTLE_WAIT_MS)

        expect(countDirty).toHaveBeenCalledTimes(1)
        expect(syncStatus.get().pendingCount).toBe(3)
    })

    it('② 同步跑完后数字回 0（运行边界仍由 endRun 落定，同源同值）', async () => {
        const service = new SyncService(echoResultsRequester())
        wireDirtyToPush(service)
        syncStatus.setPaused('offline')

        // 真实本地写（仓储 create ⇒ markDirty 入队），使 push 有可推送的实体
        const [task, createErr] = await newLocalTaskRepository().create(
            makeTaskVO({ name: 'DEF-13 待推任务' })
        )
        expect(createErr).toBeNull()
        expect(task).not.toBeNull()
        await wait(SETTLE_WAIT_MS)
        expect(syncStatus.get().pendingCount).toBe(1)

        // 恢复在线并跑一轮（pull 空 + push 全确认 ⇒ 出队）
        syncStatus.clearPaused()
        const result = await service.pushAll()

        expect(result.ok).toBe(true)
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)
        expect(syncStatus.get().pendingCount).toBe(0)
    })

    it('③ 无会话（未登录/测试环境）⇒ 不落定、不报错', async () => {
        const service = new SyncService(echoResultsRequester())
        localSession.clear()
        syncStatus.settlePendingCount(7)
        service.schedulePendingCountSettle()
        await wait(SETTLE_WAIT_MS)
        // 不因无会话把数字写成 0（保持原值，等下次运行边界或登录后入队刷新）
        expect(syncStatus.get().pendingCount).toBe(7)
    })
})