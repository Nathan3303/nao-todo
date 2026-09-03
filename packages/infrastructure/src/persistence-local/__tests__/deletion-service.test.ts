import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CreateProjectValueObject } from '@nao-todo/domain-project'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../crypto/crypto-service'
import { deletionService } from '../deletion/deletion-service'
import { localDatabase } from '../db/local-database'
import { localSession } from '../session/local-session'
import { LocalProjectRepoImpl } from '../repos/project-repo-impl'
import { LocalTaskRepoImpl } from '../repos/task-repo-impl'

/**
 * 重置本地数据库并解锁密钥
 */
const setup = async (userId = 'test-user') => {
    await Promise.all([
        localDatabase.projects.clear(),
        localDatabase.projectPreferences.clear(),
        localDatabase.tags.clear(),
        localDatabase.tagPreferences.clear(),
        localDatabase.tasks.clear(),
        localDatabase.taskCheckItems.clear(),
        localDatabase.taskComments.clear(),
        localDatabase.pomodoros.clear(),
        localDatabase.pomodoroRecords.clear(),
        localDatabase.users.clear(),
        localDatabase.userConfigs.clear(),
        localDatabase.meta.clear(),
        localDatabase.deletionSchedules.clear()
    ])
    cryptoService.lock()
    localSession.setCurrentUserId(userId)
    await cryptoService.setup(userId, 'test-password')
}

const makeTaskVO = (overrides: Partial<CreateTaskValueObject> = {}): CreateTaskValueObject =>
    new CreateTaskValueObject(
        null,
        overrides.parentTaskId ?? null,
        overrides.name ?? '测试任务',
        overrides.description ?? '',
        overrides.state ?? 'todo',
        overrides.priority ?? 'medium',
        overrides.startAt ?? null,
        overrides.endAt ?? null,
        overrides.projectId ?? 'project-1',
        overrides.tags ?? [],
        overrides.remindAt ?? null,
        overrides.remindRepeat ?? 'none',
        overrides.remindTime ?? null,
        overrides.remindWeekdays ?? []
    )

/**
 * 为指定用户造一批本地数据（项目 + 任务 + 密钥包）
 */
const seedUserData = async (userId: string) => {
    await setup(userId)
    const repo = new LocalProjectRepoImpl()
    const [project] = await repo.create(new CreateProjectValueObject(`${userId} 项目`, 'more2', ''))
    await new LocalTaskRepoImpl().create(
        makeTaskVO({ name: `${userId} 任务`, projectId: project!.id })
    )
    // 密钥包已由 setup 建立（${userId}:key-bundle）
}

describe('DeletionService 删除调度', () => {
    beforeEach(async () => {
        await setup()
    })

    it('recordDeletion 写入 now+7 天的调度', async () => {
        await deletionService.recordDeletion('user-1')
        const schedule = await localDatabase.deletionSchedules.get('user-1')
        expect(schedule).toBeDefined()
        const days = (new Date(schedule!.deadline).getTime() - Date.now()) / 86_400_000
        expect(days).toBeGreaterThan(6.9)
        expect(days).toBeLessThanOrEqual(7.1)
    })

    it('cancelDeletion 移除调度', async () => {
        await deletionService.recordDeletion('user-1')
        await deletionService.cancelDeletion('user-1')
        expect(await localDatabase.deletionSchedules.get('user-1')).toBeUndefined()
    })

    it('未到期：checkAndCleanExpired 返回 false 且数据保留', async () => {
        await seedUserData('user-1')
        await deletionService.recordDeletion('user-1')

        const cleaned = await deletionService.checkAndCleanExpired('user-1')
        expect(cleaned).toBe(false)
        expect(await localDatabase.projects.count()).toBe(1)
        expect(await localDatabase.tasks.count()).toBe(1)
    })

    it('到期：checkAndCleanExpired 清空该用户业务数据、密钥包与调度', async () => {
        await seedUserData('user-1')
        await deletionService.recordDeletion('user-1')
        // 把 deadline 改成过去，模拟 7 天已过
        await localDatabase.deletionSchedules.put({
            id: 'user-1',
            deadline: new Date(Date.now() - 1000).toISOString(),
            createdAt: new Date().toISOString()
        })

        const cleaned = await deletionService.checkAndCleanExpired('user-1')
        expect(cleaned).toBe(true)
        expect(await localDatabase.projects.count()).toBe(0)
        expect(await localDatabase.tasks.count()).toBe(0)
        expect(await localDatabase.meta.get('user-1:key-bundle')).toBeUndefined()
        expect(await localDatabase.deletionSchedules.get('user-1')).toBeUndefined()
    })

    it('多用户隔离：user-1 到期清理不影响 user-2 数据', async () => {
        await seedUserData('user-1')
        await seedUserData('user-2')
        await deletionService.recordDeletion('user-1')
        await localDatabase.deletionSchedules.put({
            id: 'user-1',
            deadline: new Date(Date.now() - 1000).toISOString(),
            createdAt: new Date().toISOString()
        })

        await deletionService.checkAndCleanExpired('user-1')

        expect(await localDatabase.projects.count()).toBe(1)
        expect(await localDatabase.tasks.count()).toBe(1)
        const [remaining] = await new LocalProjectRepoImpl().list()
        expect(remaining![0]!.name).toBe('user-2 项目')
        expect(await localDatabase.meta.get('user-2:key-bundle')).toBeDefined()
    })
})