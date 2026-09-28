// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import {
    appendConflict,
    countConflicts,
    listConflicts,
    resolveConflictKeepServer,
    resolveConflictRetryLocal
} from '../conflict-journal'
import { SyncService } from '../sync-service'
import { syncStatus } from '../sync-status'

/**
 * T331 —— 冲突处理完成后「冲突 N」计数必须随之递减 / 归零（计数与列表同源）
 *
 * 背景：徽标读 `syncStatus.conflictCount`（状态面快照），列表读 `listConflicts`（journal）；
 * 两条恢复动作只删 journal 条目、**未把 journal 的 `remaining` 写回状态面** ⇒ 徽标滞留原值
 * （应用重启时由 `restoreConflictCount` 纠正 ⇒ 用户看到「处理完不消失、重启才消失」）。
 *
 * 断言：恢复动作后 `syncStatus.conflictCount === journal 当前条数`；全部处理 ⇒ 0（徽标隐藏）；
 * 重启后（`restoreConflictCount`）与 journal 一致。两条路径（web / desktop）同基础设施代码。
 */

const USER_ID = 't331-user'

const dummyRequester = {
    get: async () => ({ data: {} }),
    post: async () => ({ data: {} }),
    put: async () => ({ data: {} }),
    delete: async () => ({ data: {} })
} as unknown as Requester

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
    localStorage.clear()
    cryptoService.lock()
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
    syncStatus.setConflictCount(0)
}

/** 模拟同步路径：appendConflict 后状态面计数 = journal 条数 */
const syncCountFromJournal = async (): Promise<void> => {
    syncStatus.setConflictCount(await countConflicts(USER_ID))
}

const seedStale = (entityId: string, name: string) =>
    appendConflict(USER_ID, { kind: 'stale', table: 'tasks', entityId, loser: { name } })

describe('T331 冲突计数随处理刷新（与 journal 同源）', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('「保留服务端版本」处理后计数 −1（改前红：滞留原值）', async () => {
        await seedStale('t1', '本地甲')
        await seedStale('t2', '本地乙')
        await syncCountFromJournal()
        expect(syncStatus.get().conflictCount).toBe(2)

        const list = await listConflicts(USER_ID)
        expect(list.items).toHaveLength(2)

        await resolveConflictKeepServer(USER_ID, 'tasks', 't1')
        expect(await countConflicts(USER_ID)).toBe(1)
        expect(syncStatus.get().conflictCount).toBe(1)
    })

    it('「以我的版本重试」处理后计数 −1（改前红）', async () => {
        const repo = newLocalTaskRepository()
        const [task] = await repo.create(
            new CreateTaskValueObject(
                null,
                null,
                '任务',
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
        const id = (task as { id: string }).id
        const [entity] = await repo.get(id)
        await appendConflict(USER_ID, {
            kind: 'remote-wins',
            table: 'tasks',
            entityId: id,
            loser: { ...(entity as unknown as Record<string, unknown>), name: '本地败方' }
        })
        await syncCountFromJournal()
        expect(syncStatus.get().conflictCount).toBe(1)

        const result = await resolveConflictRetryLocal(USER_ID, 'tasks', id)
        expect(result.ok).toBe(true)
        expect(await countConflicts(USER_ID)).toBe(0)
        expect(syncStatus.get().conflictCount).toBe(0)
    })

    it('全部处理 ⇒ 计数归零（徽标隐藏条件）', async () => {
        await seedStale('t1', '甲')
        await seedStale('t2', '乙')
        await syncCountFromJournal()

        await resolveConflictKeepServer(USER_ID, 'tasks', 't1')
        await resolveConflictKeepServer(USER_ID, 'tasks', 't2')
        expect(syncStatus.get().conflictCount).toBe(0)
    })

    it('计数与列表始终同源（处理后两者相等）', async () => {
        await seedStale('t1', '甲')
        await seedStale('t2', '乙')
        await syncCountFromJournal()
        await resolveConflictKeepServer(USER_ID, 'tasks', 't1')
        const list = await listConflicts(USER_ID)
        expect(syncStatus.get().conflictCount).toBe(list.items.length)
        expect(syncStatus.get().conflictCount).toBe(await countConflicts(USER_ID))
    })

    it('重启后计数与 journal 一致（restoreConflictCount 回归守护）', async () => {
        await seedStale('t1', '甲')
        // 模拟冷启动内存态偏差
        syncStatus.setConflictCount(999)
        const service = new SyncService(dummyRequester)
        await service.restoreConflictCount()
        expect(syncStatus.get().conflictCount).toBe(await countConflicts(USER_ID))
        expect(syncStatus.get().conflictCount).toBe(1)
    })
})