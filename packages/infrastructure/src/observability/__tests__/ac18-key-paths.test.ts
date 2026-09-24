import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase, type TaskRecord } from '../../persistence-local/db/local-database'
import { deletionService } from '../../persistence-local/deletion/deletion-service'
import {
    isPlaintextMigrationDone,
    runPlaintextMigration
} from '../../persistence-local/migration/plaintext-migration'
import { localSession } from '../../persistence-local/session/local-session'
import { STRUCTURED_LOG_EVENTS, clearStructuredLog, readStructuredLog } from '../structured-log'

/**
 * AC18 —— 迁移 / 清库关键路径产出结构化日志且**不含 PII**
 *
 * 断言：① 事件已落（started/completed）；② 序列化后的全部日志**不含** token / email /
 * 任务正文；③ 行为未变（迁移标记写入 / 清库确实清空）。
 */

const USER_ID = 'ac18-user'
const SECRET_BODY = 'AC18_SECRET_TASK_BODY'
const SECRET_EMAIL = 'ac18-secret@example.com'

const makeTaskRecord = (): TaskRecord => ({
    id: 't-ac18',
    userId: USER_ID,
    parentTaskId: '',
    // 已明文（迁移短路跳过）—— 仅用于验证「即使库里有敏感正文，日志也不得泄漏」
    name: `plain:${SECRET_BODY}`,
    description: `plain:mail ${SECRET_EMAIL}`,
    state: 'todo',
    priority: 'medium',
    startAt: '',
    endAt: '',
    projectId: '',
    tags: [],
    archivedAt: null,
    starMarkAt: null,
    givenUpAt: null,
    remindAt: '',
    remindRepeat: 'none',
    remindTime: '',
    remindWeekdays: [],
    checkItemCount: 0,
    commentCount: 0,
    subtaskCount: 0,
    sortId: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    deletedAt: null
})

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
}

const events = (): string[] => readStructuredLog().map((entry) => entry.event)

const assertNoPii = (): void => {
    const serialized = JSON.stringify(readStructuredLog())
    expect(serialized).not.toContain(SECRET_BODY)
    expect(serialized).not.toContain(SECRET_EMAIL)
}

describe('AC18：迁移 / 清库关键路径结构化日志（禁 PII）', () => {
    beforeEach(async () => {
        await resetLocalState()
        clearStructuredLog()
    })

    it('迁移 ⇒ MIGRATION_STARTED / COMPLETED，字段仅标识与计数，不含 PII', async () => {
        await localDatabase.tasks.put(makeTaskRecord())

        await runPlaintextMigration(USER_ID)

        expect(events()).toContain(STRUCTURED_LOG_EVENTS.MIGRATION_STARTED)
        expect(events()).toContain(STRUCTURED_LOG_EVENTS.MIGRATION_COMPLETED)
        const completed = readStructuredLog().find(
            (entry) => entry.event === STRUCTURED_LOG_EVENTS.MIGRATION_COMPLETED
        )
        expect(completed?.fields.userId).toBe(USER_ID)
        expect(typeof completed?.fields.ran).toBe('boolean')
        expect(typeof completed?.fields.migrated).toBe('number')
        assertNoPii()
        // 行为未变：完成标记写入
        expect(await isPlaintextMigrationDone(USER_ID)).toBe(true)
    })

    it('清库 ⇒ WIPE_STARTED / COMPLETED，不含 PII，且确实清空（行为未变）', async () => {
        await localDatabase.tasks.put(makeTaskRecord())

        await deletionService.wipeUserData(USER_ID)

        expect(events()).toContain(STRUCTURED_LOG_EVENTS.WIPE_STARTED)
        expect(events()).toContain(STRUCTURED_LOG_EVENTS.WIPE_COMPLETED)
        const completed = readStructuredLog().find(
            (entry) => entry.event === STRUCTURED_LOG_EVENTS.WIPE_COMPLETED
        )
        expect(completed?.fields.userId).toBe(USER_ID)
        assertNoPii()
        // 行为未变：清空该用户业务表
        expect(await localDatabase.tasks.where('userId').equals(USER_ID).count()).toBe(0)
    })
})