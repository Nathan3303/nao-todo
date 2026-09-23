import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import { loadMirrorStatus, saveMirrorStatus } from '../mirror-status-store'
import { syncStatus } from '../sync-status'
import { SyncService } from '../sync-service'

/**
 * T107b —— 镜像新鲜度持久化（AC8 冷启动离线）
 *
 * **缺口**：T103 落定的 `mirrorPulledAt`/`mirrorTruncated` 为内存态 ⇒ 离线冷启动（本会话未成功拉取）
 * 时 `mirrorPulledAt === null`，即使磁盘有镜像也显示「尚未同步完成」（违反 AC8）。
 *
 * **验收**：① 成功完整拉取落 `meta`；② 冷启动离线读回 ⇒ `mirrorPulledAt` 有值（AC8）；
 * ③ 从未拉取 ⇒ `null`（AC9 区分「空库」/「未同步完成」）；④ 截断落盘且不谎报完整度；
 * ⑤ 落盘**不产生** `markDirty`（C-59）。
 */

const USER_ID = 'test-user'
const EMPTY_TABLE = { items: [], total: 0, nextCursor: '', nextCursorId: '' }

/** 服务端 `/sync/pull` 响应装配（三层 `data` 与生产契约一致） */
const pullResponse = (tasks: Record<string, unknown>) => ({
    data: {
        data: {
            data: {
                tasks,
                taskCheckItems: EMPTY_TABLE,
                taskComments: EMPTY_TABLE,
                projects: EMPTY_TABLE,
                tags: EMPTY_TABLE,
                pomodoros: EMPTY_TABLE,
                pomodoroRecords: EMPTY_TABLE
            }
        }
    },
    serverTime: Date.now()
})

const remoteTask = (id: string): Record<string, unknown> => {
    const at = new Date(Date.UTC(2026, 0, 1)).toISOString()
    return {
        id,
        createdAt: at,
        updatedAt: at,
        deletedAt: null,
        parentTaskId: null,
        name: id,
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
}

/** 在线：单行任务即取尽（`items.length < PULL_LIMIT`） */
const onlineRequester = (): Requester =>
    ({
        post: async (url: string) =>
            url === '/sync/pull'
                ? pullResponse({
                      items: [remoteTask('t-1')],
                      total: 1,
                      nextCursor: '',
                      nextCursorId: ''
                  })
                : { data: {} },
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    }) as unknown as Requester

/** 离线：归一化网络错误（`pullAllInner` 识别后中止，不推进完整度） */
const offlineRequester = (): Requester =>
    ({
        post: async () => ({ code: 'ERR_NETWORK', data: { data: null } }),
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    }) as unknown as Requester

const setup = async (): Promise<void> => {
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
    // 模拟冷启动：内存态归零（磁盘事实由各用例单独布置）
    syncStatus.restoreMirrorStatus({ mirrorPulledAt: null, mirrorTruncated: false })
}

describe('T107b：镜像新鲜度持久化（AC8 冷启动离线）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('成功完整拉取 ⇒ 落 meta（mirrorPulledAt 有值 + truncated=false）且不产生 markDirty（C-59）', async () => {
        const service = new SyncService(onlineRequester())
        await service.pullAll()

        const persisted = await loadMirrorStatus(USER_ID)
        expect(persisted).not.toBeNull()
        expect(persisted!.mirrorPulledAt).toBeTruthy()
        expect(persisted!.mirrorTruncated).toBe(false)
        // C-59：落盘走 meta 直连，不入脏队列
        expect(await localDatabase.syncQueue.count()).toBe(0)
    })

    it('AC8：冷启动离线 + 磁盘有镜像 ⇒ start() 读回后 mirrorPulledAt 有值', async () => {
        // 前一会话成功完整拉取的磁盘事实
        const pulledAt = '2026-09-23T07:00:00.000Z'
        await saveMirrorStatus(USER_ID, { mirrorPulledAt: pulledAt, mirrorTruncated: false })
        // 本会话内存态归零（setup 已完成）
        expect(syncStatus.get().mirrorPulledAt).toBeNull()

        await new SyncService(offlineRequester()).start()

        expect(syncStatus.get().mirrorPulledAt).toBe(pulledAt)
        expect(syncStatus.get().mirrorTruncated).toBe(false)
    })

    it('AC9：从未成功拉取（meta 无记录）⇒ 冷启动离线仍为 null（与「空库」可区分）', async () => {
        expect(await loadMirrorStatus(USER_ID)).toBeNull()

        await new SyncService(offlineRequester()).start()

        expect(syncStatus.get().mirrorPulledAt).toBeNull()
        expect(syncStatus.get().mirrorTruncated).toBe(false)
    })

    it('续拉上界截断 ⇒ 落盘 truncated=true 且不推进 mirrorPulledAt（不谎报完整度）', async () => {
        // 时间预算 0 ⇒ 首轮即触顶截断，不发起请求
        const service = new SyncService(onlineRequester(), { pullTimeBudgetMs: 0 })
        await service.pullAll()

        const persisted = await loadMirrorStatus(USER_ID)
        expect(persisted).not.toBeNull()
        expect(persisted!.mirrorTruncated).toBe(true)
        expect(persisted!.mirrorPulledAt).toBeNull()

        // 冷启动离线：截断事实同样可读回（不误显示「数据截至 X」）
        syncStatus.restoreMirrorStatus({ mirrorPulledAt: null, mirrorTruncated: false })
        await new SyncService(offlineRequester()).start()
        expect(syncStatus.get().mirrorPulledAt).toBeNull()
        expect(syncStatus.get().mirrorTruncated).toBe(true)
    })
})