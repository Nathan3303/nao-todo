import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { syncStatus } from '../sync-status'
import { syncTracker } from '../sync-tracker'
import { SyncService } from '../sync-service'
import {
    AUTO_REFRESH_INTERVAL_MS,
    createAutoRefreshController,
    type AutoRefreshController,
    type AutoRefreshTimerHandle
} from '../auto-refresh'

/**
 * T654 · AC1 / AC2 —— 可见窗口周期拉取后**数据真的出现**（真 `SyncService` + 真本地库）
 *
 * @description 门控层只负责「何时拉」（见 `t654-auto-refresh-gates.test.ts`）；
 *              本文件用**真** `SyncService` + fake-indexeddb 证明：一次周期 tick 之后
 *              他端改动进入本地镜像（AC1），且 `lastSyncAt` / `mirrorPulledAt` 前进（AC2）。
 *              ⚠️ 不定时器：用「可手动触发的定时器」代替 `advanceTimersByTime`（避免与 IndexedDB 抢时钟）。
 * @see docs/prds/2026-11-05-sync-perception-polling.md（AC1 / AC2）
 */

const USER_ID = 'test-user'

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

/** 他端改动后的任务（id 固定，标题即「买牛奶」场景） */
const REMOTE_TASK = {
    id: 't-milk',
    createdAt: '2026-11-05T00:00:00.000Z',
    updatedAt: '2026-11-05T00:00:05.000Z',
    deletedAt: null,
    parentTaskId: null,
    name: '买牛奶',
    description: '',
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
}

const pullRequester = (): { requester: Requester; pullCalls: () => number } => {
    let pulls = 0
    const requester = {
        post: async (url: string) => {
            if (url === '/sync/pull') {
                pulls += 1
                return {
                    data: {
                        data: {
                            data: {
                                projects: { items: [] },
                                tags: { items: [] },
                                tasks: { items: [REMOTE_TASK] },
                                taskCheckItems: { items: [] },
                                taskComments: { items: [] },
                                pomodoros: { items: [] },
                                pomodoroRecords: { items: [] }
                            }
                        }
                    },
                    serverTime: Date.now()
                }
            }
            return { data: { results: [] }, serverTime: Date.now() }
        },
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    } as unknown as Requester
    return { requester, pullCalls: () => pulls }
}

/** 手动触发的定时器（时钟只影响门控层，不影响 IndexedDB） */
const createManualTimer = (): {
    setTimeout: (fn: () => void, delayMs: number) => AutoRefreshTimerHandle
    clearTimeout: (handle: AutoRefreshTimerHandle) => void
    lastDelay: () => number | null
    fire: () => Promise<void>
} => {
    let pending: { fn: () => void; delayMs: number } | null = null
    return {
        setTimeout: (fn, delayMs) => {
            pending = { fn, delayMs }
            return 1
        },
        clearTimeout: () => {
            pending = null
        },
        lastDelay: () => pending?.delayMs ?? null,
        fire: async () => {
            const task = pending
            pending = null
            task?.fn()
            // 让拉取（网络替身 + 加解密 + IndexedDB）走完
            for (let i = 0; i < 40; i += 1) await new Promise((resolve) => setTimeout(resolve, 10))
        }
    }
}

describe('T654 · AC1 / AC2 周期拉取把「他端改动」带进本地镜像', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    afterEach(() => {
        // 同步状态是全局单例：用例间复位，避免 syncing/lastSyncAt 串味
        syncStatus.endRun({ pendingCount: 0, failedCount: 0 })
    })

    it('AC1：窗口可见且队列为空 ⇒ 一个周期（30s）内新任务出现在本地列表（无需手动同步）', async () => {
        const { requester, pullCalls } = pullRequester()
        const service = new SyncService(requester)
        const timer = createManualTimer()

        const controller: AutoRefreshController = createAutoRefreshController({
            pull: async (trigger) => {
                const result =
                    trigger === 'periodic'
                        ? await service.pullAll()
                        : await service.resumeBackfill()
                return { ok: result.ok, stop: result.credentialFailure }
            },
            hasPendingLocalWrites: async () => (await syncTracker.countDirty(USER_ID)) > 0,
            isVisible: () => true,
            isOffline: () => false,
            setTimeout: timer.setTimeout,
            clearTimeout: timer.clearTimeout
        })

        controller.start()
        // 周期 = 30s（≤30s 指标的直接依据）；启动本身不发请求
        expect(timer.lastDelay()).toBe(AUTO_REFRESH_INTERVAL_MS)
        expect(AUTO_REFRESH_INTERVAL_MS).toBeLessThanOrEqual(30_000)
        expect(pullCalls()).toBe(0)

        await timer.fire()

        expect(pullCalls()).toBe(1)
        const repo = newLocalTaskRepository()
        const [task] = await repo.get('t-milk')
        expect(task?.name).toBe('买牛奶')
        // 下一个周期已排定 ⇒ 数据会持续收敛（不是一次性）
        expect(timer.lastDelay()).toBe(AUTO_REFRESH_INTERVAL_MS)
    })

    it('AC2：周期拉取成功后 lastSyncAt / mirrorPulledAt 前进，且不残留「同步中」', async () => {
        const { requester } = pullRequester()
        const service = new SyncService(requester)
        const timer = createManualTimer()
        const controller = createAutoRefreshController({
            pull: async () => {
                const result = await service.pullAll()
                return { ok: result.ok, stop: result.credentialFailure }
            },
            hasPendingLocalWrites: async () => false,
            isVisible: () => true,
            isOffline: () => false,
            setTimeout: timer.setTimeout,
            clearTimeout: timer.clearTimeout
        })

        controller.start()
        const before = syncStatus.get()

        await timer.fire()

        const after = syncStatus.get()
        expect(after.mirrorPulledAt).not.toBeNull()
        expect(after.lastSyncAt).not.toBeNull()
        // 新全球单例在用例间不重置 ⇒ 断言「前进」而非「从 null 变有值」
        expect(Date.parse(after.mirrorPulledAt as string)).toBeGreaterThanOrEqual(
            Date.parse(before.mirrorPulledAt ?? '1970-01-01T00:00:00.000Z')
        )
        expect(after.syncing).toBe(false)
        expect(after.errorCount).toBe(0)
        controller.dispose()
    })
})