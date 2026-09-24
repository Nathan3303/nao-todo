// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import { syncTracker } from '../sync-tracker'
import { SyncService } from '../sync-service'

/**
 * T162 用例先行（红基线）—— 阶段二 2B · 面 ④ 多标签 push 单主
 *
 * 契约（ADR §9.3 / §9.6 R-14 / R-17）：
 * - push 加 `navigator.locks` 单主（`nao-todo:push:${userId}`，`ifAvailable`），与 pull 同构；
 * - **未取得锁 ⇒ 跳过本次 push**：不发起网络请求、**不消耗重试**、队列保留
 *   （由他标签 / 既有触发源补推 ⇒ 守护「不丢」R-17）；
 * - 锁由 API 自动释放（不手工 release）；
 * - 环境无 `navigator.locks` ⇒ 降级直接执行（同 pull）。
 *
 * **红窗口**：①②预期**红**（push 尚无锁）；③④现状已绿。
 */

const USER_ID = 'push-lock-user'

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
}

/** 建本地任务（⇒ syncQueue 有 1 条 due 项） */
const makeDirtyTask = async (): Promise<string> => {
    const [task, err] = await newLocalTaskRepository().create(
        new CreateTaskValueObject(
            null,
            null,
            '待推任务',
            '',
            'todo',
            'medium',
            null,
            null,
            'p-1',
            [],
            null,
            'none',
            null,
            []
        )
    )
    expect(err).toBeNull()
    return (task as { id: string }).id
}

/** push 回显请求体 id 的 requester（成功 applied） */
const pushEchoRequester = (): { requester: Requester; post: ReturnType<typeof vi.fn> } => {
    const post = vi.fn(async (url: string, body: unknown) => {
        if (url !== '/sync/push') return { data: {} }
        const tasks = (body as { tasks?: { id: string }[] }).tasks ?? []
        return {
            data: {
                data: {
                    results: tasks.map((task) => ({
                        table: 'tasks',
                        id: task.id,
                        serverUpdatedAt: '2026-01-05T00:00:00.000Z',
                        outcome: 'applied'
                    }))
                },
                serverTime: Date.now()
            }
        }
    })
    const requester = {
        post,
        get: vi.fn(async () => ({ data: {} })),
        put: vi.fn(async () => ({ data: {} })),
        delete: vi.fn(async () => ({ data: {} }))
    } as unknown as Requester
    return { requester, post }
}

/** push 回显请求体 id 且 outcome 为 `stale` 的 requester（触发 journal 写入） */
const stalePushRequester = (): { requester: Requester } => {
    const post = vi.fn(async (url: string, body: unknown) => {
        if (url !== '/sync/push') return { data: {} }
        const tasks = (body as { tasks?: { id: string }[] }).tasks ?? []
        return {
            data: {
                data: {
                    results: tasks.map((task) => ({
                        table: 'tasks',
                        id: task.id,
                        serverUpdatedAt: '2026-01-05T00:00:00.000Z',
                        outcome: 'stale'
                    }))
                },
                serverTime: Date.now()
            }
        }
    })
    const requester = {
        post,
        get: vi.fn(async () => ({ data: {} })),
        put: vi.fn(async () => ({ data: {} })),
        delete: vi.fn(async () => ({ data: {} }))
    } as unknown as Requester
    return { requester }
}

/** 把唯一队列项改为「已退避未到期」→ 仍 due（nextAttemptAt 过期）；attempts 预置 2 */
const seedBackoff = async (): Promise<void> => {
    const [item] = await syncTracker.listDirty(USER_ID)
    await localDatabase.syncQueue.put({
        ...item!,
        attempts: 2,
        retryCount: 2,
        nextAttemptAt: new Date(Date.now() - 60_000).toISOString(),
        lastErrorClass: 'business'
    })
}

describe('面 ④ 多标签 push 单主（navigator.locks）', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('① 未取得锁 ⇒ 跳过 push（不发请求）+ 不消耗重试 + 队列保留（R-14 / R-17）', async () => {
        const request = vi.fn(
            async (
                _name: string,
                _options: unknown,
                callback: (lock: unknown) => Promise<void>
            ): Promise<void> => {
                await callback(null)
            }
        )
        vi.stubGlobal('navigator', { locks: { request } })
        const id = await makeDirtyTask()
        await seedBackoff()
        const { requester, post } = pushEchoRequester()

        await new SyncService(requester).pushAll()

        expect(request).toHaveBeenCalledTimes(1)
        expect(request.mock.calls[0]![0]).toBe(`nao-todo:push:${USER_ID}`)
        expect((request.mock.calls[0]![1] as { ifAvailable?: boolean }).ifAvailable).toBe(true)
        expect(post).not.toHaveBeenCalled()
        // 队列保留（不丢）且退避进度不因「未取锁」而消耗
        expect(await syncTracker.countDirty(USER_ID)).toBe(1)
        const queue = await syncTracker.listDirty(USER_ID)
        expect(queue[0]!.entityId).toBe(id)
        expect(queue[0]!.attempts).toBe(2)
        expect(queue[0]!.nextAttemptAt).toBeTruthy()
    })

    it('② 取得锁 ⇒ 正常 push（出队）', async () => {
        const request = vi.fn(
            async (
                _name: string,
                _options: unknown,
                callback: (lock: unknown) => Promise<void>
            ): Promise<void> => {
                await callback({ name: 'fake-lock' })
            }
        )
        vi.stubGlobal('navigator', { locks: { request } })
        await makeDirtyTask()
        const { requester, post } = pushEchoRequester()

        await new SyncService(requester).pushAll()

        expect(request).toHaveBeenCalledTimes(1)
        expect(request.mock.calls[0]![0]).toBe(`nao-todo:push:${USER_ID}`)
        expect(post).toHaveBeenCalledTimes(1)
        expect(post.mock.calls[0]![0] as string).toBe('/sync/push')
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)
    })

    it('③ 环境无 navigator.locks ⇒ 降级直接执行（不失败）', async () => {
        vi.stubGlobal('navigator', {})
        await makeDirtyTask()
        const { requester, post } = pushEchoRequester()

        await new SyncService(requester).pushAll()

        expect(post).toHaveBeenCalledTimes(1)
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)
    })

    it('④ 锁由 API 自动释放（不手工 release）⇒ 连续两次 push 均可执行', async () => {
        const held = new Set<string>()
        const request = vi.fn(
            async (
                name: string,
                _options: unknown,
                callback: (lock: unknown) => Promise<void>
            ): Promise<void> => {
                if (held.has(name)) {
                    await callback(null)
                    return
                }
                held.add(name)
                try {
                    await callback({ name })
                } finally {
                    held.delete(name)
                }
            }
        )
        vi.stubGlobal('navigator', { locks: { request } })
        const { requester, post } = pushEchoRequester()

        await makeDirtyTask()
        await new SyncService(requester).pushAll()
        await makeDirtyTask()
        await new SyncService(requester).pushAll()

        expect(request).toHaveBeenCalledTimes(2)
        expect(post).toHaveBeenCalledTimes(2)
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)
    })

    it('⑤ journal 写入发生在 push 锁内（ADR §9.3：meta RMW 互斥守护）', async () => {
        let pushLockHeld = false
        const request = vi.fn(async (name: string, a: unknown, b?: unknown): Promise<void> => {
            const callback = (typeof a === 'function' ? a : b) as (lock: unknown) => Promise<void>
            // 仅跟踪 push 单主锁；journal 专用锁（T166b）为其**内层**，直接执行
            if (!name.startsWith('nao-todo:push:')) {
                await callback({ name })
                return
            }
            pushLockHeld = true
            try {
                await callback({ name })
            } finally {
                pushLockHeld = false
            }
        })
        vi.stubGlobal('navigator', { locks: { request } })

        // 记录 journal 落 `meta` 单记录（`conflictJournal`）那一刻是否持 push 锁
        const journalWriteLockHeld: boolean[] = []
        const originalPut = localDatabase.meta.put.bind(localDatabase.meta)
        vi.spyOn(localDatabase.meta, 'put').mockImplementation((async (
            record: unknown,
            ...rest: unknown[]
        ) => {
            if ((record as { conflictJournal?: unknown }).conflictJournal !== undefined) {
                journalWriteLockHeld.push(pushLockHeld)
            }
            return originalPut(record as never, ...(rest as never[]))
        }) as never)

        await makeDirtyTask()
        const { requester } = stalePushRequester()

        await new SyncService(requester).pushAll()

        // outcome=stale 被消费 ⇒ journal 确实写入，且写入时刻**持 push 锁**（与 pull 侧互斥）
        expect(journalWriteLockHeld).toEqual([true])
    })
})