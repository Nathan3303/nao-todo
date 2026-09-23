import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../crypto/crypto-service'
import { localDatabase } from '../db/local-database'
import { localSession } from '../session/local-session'

/**
 * 重置本地数据库并解锁密钥
 */

export const setup = async (userId = 'test-user') => {
    // 串行清空，避免 fake-indexeddb 下并行事务竞态导致 clear 丢失
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
    cryptoService.lock()
    localSession.setCurrentUserId(userId)
    await cryptoService.setup(userId, 'test-password')
}

/**
 * 切换当前用户（保留库内既有数据，仅更换会话与密钥）
 * @description 已有密钥包则用密码 unlock 还原原 DEK，没有则首次 setup
 */

export const switchUser = async (userId: string) => {
    cryptoService.lock()
    localSession.setCurrentUserId(userId)
    await cryptoService.ensureUnlocked(userId, 'test-password')
}

export const makeTaskVO = (overrides: Partial<CreateTaskValueObject> = {}): CreateTaskValueObject =>
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