import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import { saveMirrorStatus } from '../mirror-status-store'
import { createPullBroadcast, type PullBroadcastChannelLike } from '../pull-broadcast'
import { syncStatus } from '../sync-status'
import { SyncService } from '../sync-service'

/**
 * T659 · DEF-142 —— 广播命中后「新鲜度」必须收敛（R-7：界面只读 `mirrorPulledAt`）
 *
 * @description 修前：非主标签收到广播 ⇒ 数据刷新了、合并门时间收敛了，但 `syncStatus.mirrorPulledAt`
 *              停在旧值（qa `T655` 探针实测 2020-01-01）⇒ 「数据已新、面板更旧」两处判据不一致。
 *              修法不新增真源：主标签**先落盘再广播**，非主标签重读**同一** IndexedDB 的 `meta` 收敛。
 *
 *              同时锁定两条边界（T659 追加约束）：
 *              - 截断未补齐（`mirrorTruncated=true`）**不得**因为收到广播而被清成 `false`（DEF-6 假绿）；
 *              - 完整拉取（`pending.size===0`）仍清截断标志（既有语义不回归）。
 * @see docs/prds/2026-11-05-sync-perception-polling.md（R-6 / R-7 / AC7）
 */

const USER_ID = 'test-user'
const OLD_PULLED_AT = '2020-01-01T00:00:00.000Z'

const resetLocalState = async (): Promise<void> => {
    await localDatabase.projects.clear()
    await localDatabase.projectPreferences.clear()
    await localDatabase.tags.clear()
    await localDatabase.tagPreferences.clear()
    await localDatabase.tasks.clear()
    await localDatabase.taskCheckItems.clear()
    await localDatabase.taskComments.clear()
    await localDatabase.pomodoros.clear()
    await localDatabase.pomodoroRecords.clear()
    await localDatabase.users.clear()
    await localDatabase.userConfigs.clear()
    await localDatabase.meta.clear()
    await localDatabase.deletionSchedules.clear()
    await localDatabase.syncQueue.clear()
    await localDatabase.syncCursor.clear()
    cryptoService.lock()
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
    syncStatus.restoreMirrorStatus({ mirrorPulledAt: null, mirrorTruncated: false })
}

/** 空数据成功响应（`90020` + 表信袋 ⇒ 完整拉取） */
const pullRequester = (): { requester: Requester; calls: () => number } => {
    let calls = 0
    const requester = {
        post: async (url: string) => {
            calls += 1
            if (url === '/sync/pull') {
                return { data: { code: 90020, data: { data: {} } }, serverTime: Date.now() }
            }
            return { data: { results: [] }, serverTime: Date.now() }
        },
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    } as unknown as Requester
    return { requester, calls: () => calls }
}

/** 假 `BroadcastChannel`（投递给其它实例） */
class FakeBroadcastChannel implements PullBroadcastChannelLike {
    static instances: FakeBroadcastChannel[] = []
    private listeners = new Set<(event: { data: unknown }) => void>()
    closed = false
    constructor(public readonly name: string) {
        FakeBroadcastChannel.instances.push(this)
    }
    postMessage(message: unknown): void {
        for (const target of FakeBroadcastChannel.instances) {
            if (target === this || target.closed) continue
            for (const listener of target.listeners) listener({ data: message })
        }
    }
    addEventListener(_type: 'message', listener: (event: { data: unknown }) => void): void {
        this.listeners.add(listener)
    }
    removeEventListener(_type: 'message', listener: (event: { data: unknown }) => void): void {
        this.listeners.delete(listener)
    }
    close(): void {
        this.closed = true
    }
}

describe('T659 · DEF-142 广播命中的新鲜度收敛', () => {
    beforeEach(async () => {
        FakeBroadcastChannel.instances = []
        vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
        vi.stubGlobal('navigator', {})
        await resetLocalState()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
        FakeBroadcastChannel.instances = []
    })

    it('① 非主标签收广播 ⇒ mirrorPulledAt 前进到主标签已落盘的事实，且**零网络**', async () => {
        // 主标签：真实拉取成功（写 meta + 广播一条）
        const master = pullRequester()
        const masterService = new SyncService(master.requester)
        const subscriber = createPullBroadcast()
        const broadcasts: unknown[] = []
        subscriber.subscribe((message) => broadcasts.push(message))
        const masterResult = await masterService.pullAll()
        expect(masterResult.ok).toBe(true)
        expect(broadcasts).toHaveLength(1)
        const masterPulledAt = syncStatus.get().mirrorPulledAt
        expect(masterPulledAt).not.toBeNull()

        // 模拟「非主标签」：内存态停在旧值（qa 探针的现场）
        syncStatus.restoreMirrorStatus({
            mirrorPulledAt: OLD_PULLED_AT,
            mirrorTruncated: false
        })
        const follower = pullRequester()
        const followerService = new SyncService(follower.requester)
        const refreshed = vi.fn()
        followerService.setDataChangedListener(refreshed)

        await followerService.applyForeignPullComplete(Date.now())

        // ① 新鲜度收敛到主标签落盘事实（不倒退；允许比落盘值略晚几毫秒 = 广播时间）
        const converged = syncStatus.get().mirrorPulledAt as string
        expect(Date.parse(converged)).toBeGreaterThan(Date.parse(OLD_PULLED_AT))
        expect(Date.parse(converged)).toBeGreaterThanOrEqual(Date.parse(masterPulledAt as string))
        // ② 零网络（非主标签不得二次拉取）
        expect(follower.calls()).toBe(0)
        // ③ 视图刷新仍是同步动作
        expect(refreshed).toHaveBeenCalledTimes(1)
        // ④ 合并门时间也收敛（T654 语义保持）
        expect(followerService.getLastSuccessfulPullAt()).not.toBeNull()
        subscriber.dispose()
    })

    it('② 主标签自身拉取路径不回归：applyForeignPullComplete 不触发再次广播（含收到他人广播）', async () => {
        const master = pullRequester()
        const masterService = new SyncService(master.requester)
        const subscriber = createPullBroadcast()
        const broadcasts: unknown[] = []
        subscriber.subscribe((message) => broadcasts.push(message))

        await masterService.pullAll()
        expect(broadcasts).toHaveLength(1)

        // 主标签自己收到（或误收）一条广播 ⇒ 只收敛本地状态，不重新广播
        await masterService.applyForeignPullComplete(Date.now())
        expect(broadcasts).toHaveLength(1)
        // 载荷键集合仍是恰好 3 键（无数据载荷）
        expect(Object.keys(broadcasts[0] as object).sort()).toEqual(['at', 'type', 'userId'])
        subscriber.dispose()
    })

    it('③ 截断态（mirrorTruncated=true）+ 广播 ⇒ mirrorPulledAt 可前进，但**截断标志不清**', async () => {
        await saveMirrorStatus(USER_ID, { mirrorPulledAt: OLD_PULLED_AT, mirrorTruncated: true })
        syncStatus.restoreMirrorStatus({ mirrorPulledAt: OLD_PULLED_AT, mirrorTruncated: true })

        const follower = pullRequester()
        const followerService = new SyncService(follower.requester)
        const broadcastAt = Date.now()

        await followerService.applyForeignPullComplete(broadcastAt)

        const after = syncStatus.get()
        expect(after.mirrorPulledAt).not.toBe(OLD_PULLED_AT)
        expect(Date.parse(after.mirrorPulledAt as string)).toBeGreaterThanOrEqual(broadcastAt)
        // ⛔ 收敛时间戳 ≠ 镜像已完整（截断未补齐不得假绿）
        expect(after.mirrorTruncated).toBe(true)
        expect(follower.calls()).toBe(0)
    })

    it('④ 完整拉取（取尽）⇒ mirrorTruncated 回到 false（既有语义不回归）', async () => {
        syncStatus.restoreMirrorStatus({ mirrorPulledAt: OLD_PULLED_AT, mirrorTruncated: true })
        const { requester } = pullRequester()
        const service = new SyncService(requester)

        const result = await service.pullAll()

        expect(result.ok).toBe(true)
        const after = syncStatus.get()
        expect(after.mirrorTruncated).toBe(false)
        expect(after.mirrorPulledAt).not.toBe(OLD_PULLED_AT)
    })
})