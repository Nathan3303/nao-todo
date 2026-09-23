import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import {
    STRUCTURED_LOG_EVENTS,
    clearStructuredLog,
    readStructuredLog
} from '../../observability/structured-log'
import { SyncService } from '../sync-service'

/**
 * T109b —— `navigator.locks` pull 单主（C-66 / AC16a 代偿）
 *
 * 断言：
 * ① 未取得锁 ⇒ **跳过**本次 pull（不排队、不发请求），且 `pullExecuted === false`
 *    （T108 只读闸门解除条件 = `ok && !credentialFailure && pullExecuted` ⇒ flag 不被误清）；
 * ② 取得锁 ⇒ 正常拉取（`pullExecuted === true`），锁名按 `userId` 隔离；
 * ③ 无 `navigator.locks` ⇒ 降级直接执行（不失败）+ 记日志；
 * ④ 锁由 API 自动释放（不手工 release）⇒ 连续拉取均可取得；
 * ⑤ 锁被占用时**不排队等待**（并发下第二个跳过）；
 * ⑥ sync 路径结构化日志不含 PII。
 */

const USER_ID = 'test-user'
const SECRET_BODY = 'SYNC_SECRET_TASK_BODY'
const SECRET_EMAIL = 'sync-secret@example.com'

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

/** 空数据成功拉取响应（每表无 items ⇒ 单轮取尽） */
const emptyPullRequester = (): { requester: Requester; post: ReturnType<typeof vi.fn> } => {
    const post = vi.fn(async (url: string) =>
        url === '/sync/pull'
            ? { data: { data: { data: {} } }, serverTime: Date.now() }
            : { data: {} }
    )
    const requester = {
        post,
        get: vi.fn(async () => ({ data: {} })),
        put: vi.fn(async () => ({ data: {} })),
        delete: vi.fn(async () => ({ data: {} }))
    } as unknown as Requester
    return { requester, post }
}

const remoteTask = (): Record<string, unknown> => ({
    id: 't-secret',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    parentTaskId: null,
    name: SECRET_BODY,
    description: SECRET_EMAIL,
    state: 'todo',
    priority: 'medium',
    startAt: null,
    endAt: null,
    projectId: null,
    tags: [],
    archivedAt: null,
    starMarkAt: null,
    givenUpAt: null,
    remindAt: null,
    remindRepeat: 'none',
    remindTime: null,
    remindWeekdays: [],
    checkItemCount: 0,
    commentCount: 0,
    subtaskCount: 0,
    sortId: 0
})

const events = (): string[] => readStructuredLog().map((entry) => entry.event)

describe('T109b：navigator.locks pull 单主', () => {
    beforeEach(async () => {
        await resetLocalState()
        clearStructuredLog()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('① 未取得锁 ⇒ 跳过 pull（不发请求），ok=true 但 pullExecuted=false（T108 闸门不被误清）', async () => {
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
        const { requester, post } = emptyPullRequester()

        const result = await new SyncService(requester).pullAll()

        expect(request).toHaveBeenCalledTimes(1)
        expect(request.mock.calls[0]![0]).toBe(`nao-todo:pull:${USER_ID}`)
        expect(post).not.toHaveBeenCalled()
        expect(result.ok).toBe(true)
        expect(result.pullExecuted).toBe(false)
        // T108 解除条件：`ok && !credentialFailure && pullExecuted` ⇒ 未取得锁时**不得**确认
        expect(result.ok && !result.credentialFailure && result.pullExecuted).toBe(false)
        // 结构化日志：跳过事件已记；未记 started（确实没拉）
        expect(events()).toContain(STRUCTURED_LOG_EVENTS.SYNC_PULL_LOCK_SKIPPED)
        expect(events()).not.toContain(STRUCTURED_LOG_EVENTS.SYNC_PULL_STARTED)
    })

    it('② 取得锁 ⇒ 正常拉取（pullExecuted=true）', async () => {
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
        const { requester, post } = emptyPullRequester()

        const result = await new SyncService(requester).pullAll()

        expect(post).toHaveBeenCalledTimes(1)
        expect(result.ok).toBe(true)
        expect(result.pullExecuted).toBe(true)
        expect(events()).toContain(STRUCTURED_LOG_EVENTS.SYNC_PULL_STARTED)
        expect(events()).toContain(STRUCTURED_LOG_EVENTS.SYNC_PULL_COMPLETED)
        expect(events()).not.toContain(STRUCTURED_LOG_EVENTS.SYNC_PULL_LOCK_SKIPPED)
    })

    it('③ 锁名按 userId 隔离（不同账号互不阻塞）', async () => {
        const names: string[] = []
        const request = vi.fn(
            async (
                name: string,
                _options: unknown,
                callback: (lock: unknown) => Promise<void>
            ): Promise<void> => {
                names.push(name)
                await callback({ name: 'fake-lock' })
            }
        )
        vi.stubGlobal('navigator', { locks: { request } })

        await new SyncService(emptyPullRequester().requester).pullAll()
        localSession.setCurrentUserId('u-2')
        await new SyncService(emptyPullRequester().requester).pullAll()

        expect(names).toEqual([`nao-todo:pull:${USER_ID}`, 'nao-todo:pull:u-2'])
    })

    it('④ 环境无 navigator.locks ⇒ 降级直接执行（不失败）+ 记日志', async () => {
        vi.stubGlobal('navigator', {})
        const { requester, post } = emptyPullRequester()

        const result = await new SyncService(requester).pullAll()

        expect(post).toHaveBeenCalledTimes(1)
        expect(result.ok).toBe(true)
        expect(result.pullExecuted).toBe(true)
        expect(events()).toContain(STRUCTURED_LOG_EVENTS.SYNC_PULL_LOCK_UNAVAILABLE)
    })

    it('⑤ 锁由 API 自动释放（不手工 release）⇒ 连续两次拉取均可取得', async () => {
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
        const { requester, post } = emptyPullRequester()

        const first = await new SyncService(requester).pullAll()
        const second = await new SyncService(requester).pullAll()

        expect(first.pullExecuted).toBe(true)
        expect(second.pullExecuted).toBe(true)
        expect(post).toHaveBeenCalledTimes(2)
    })

    it('⑥ 锁被占用 ⇒ 不排队等待：持锁期间第二个调用跳过', async () => {
        const held = new Set<string>()
        let signalAcquired: (() => void) | undefined
        const acquired = new Promise<void>((resolve) => {
            signalAcquired = resolve
        })
        let acquisitions = 0
        let releaseFirst: (() => void) | undefined
        const gate = new Promise<void>((resolve) => {
            releaseFirst = resolve
        })
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
                acquisitions += 1
                if (acquisitions === 1) signalAcquired?.()
                try {
                    if (acquisitions === 1) await gate
                    await callback({ name })
                } finally {
                    held.delete(name)
                }
            }
        )
        vi.stubGlobal('navigator', { locks: { request } })

        const first = new SyncService(emptyPullRequester().requester).pullAll()
        await acquired

        const second = await new SyncService(emptyPullRequester().requester).pullAll()
        expect(second.pullExecuted).toBe(false)

        releaseFirst?.()
        expect((await first).pullExecuted).toBe(true)
    })

    it('⑦ AC18：sync 路径结构化日志不含 PII（token / email / 任务正文）', async () => {
        const post = vi.fn(async (url: string) =>
            url === '/sync/pull'
                ? {
                      data: {
                          data: {
                              data: {
                                  tasks: {
                                      items: [remoteTask()],
                                      total: 1,
                                      nextCursor: '',
                                      nextCursorId: ''
                                  }
                              }
                          }
                      },
                      serverTime: Date.now()
                  }
                : { data: {} }
        )
        const requester = {
            post,
            get: vi.fn(async () => ({ data: {} })),
            put: vi.fn(async () => ({ data: {} })),
            delete: vi.fn(async () => ({ data: {} }))
        } as unknown as Requester

        const result = await new SyncService(requester).pullAll()

        expect(result.pullExecuted).toBe(true)
        const serialized = JSON.stringify(readStructuredLog())
        expect(serialized).not.toContain(SECRET_BODY)
        expect(serialized).not.toContain(SECRET_EMAIL)
    })
})