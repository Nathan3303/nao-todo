import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { ProjectEntity } from '@nao-todo/domain-project'
import { TaskEntity } from '@nao-todo/domain-task'
import { cryptoService } from '../../crypto/crypto-service'
import { localDatabase } from '../../db/local-database'
import { localSession } from '../../session/local-session'
import type { ProjectRecord, TaskRecord } from '../../db/local-database'
import { projectEntityToRecord, projectRecordToEntity } from '../project'
import { taskEntityToRecord, taskRecordToEntity } from '../task'

/**
 * 建立会话 + 密钥（record↔entity 转换需解密 name/description）
 */
const setup = async (userId = 'test-user') => {
    await localDatabase.tasks.clear()
    await localDatabase.projects.clear()
    await localDatabase.meta.clear()
    cryptoService.lock()
    localSession.setCurrentUserId(userId)
    await cryptoService.setup(userId, 'test-password')
}

describe('本地 record↔entity 计数兜底（U-C2）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('taskEntityToRecord 写入计数；存量记录（无计数字段）读出兜底 0', async () => {
        const entity = new TaskEntity(
            't-1',
            '2024-01-01T00:00:00.000Z',
            '2024-01-02T00:00:00.000Z',
            null,
            '',
            '任务',
            '描述',
            'todo',
            'medium',
            '',
            '',
            'p-1',
            [],
            null,
            null,
            null,
            '',
            'none',
            '',
            [],
            3,
            2,
            1
        )
        const record = await taskEntityToRecord(entity, 'test-user')
        expect(record.checkItemCount).toBe(3)
        expect(record.commentCount).toBe(2)
        expect(record.subtaskCount).toBe(1)

        // 模拟存量记录（旧库无计数字段）
        const legacy = { ...record } as Record<string, unknown>
        delete legacy.checkItemCount
        delete legacy.commentCount
        delete legacy.subtaskCount
        const restored = await taskRecordToEntity(legacy as unknown as TaskRecord)
        expect(restored.checkItemCount).toBe(0)
        expect(restored.commentCount).toBe(0)
        expect(restored.subtaskCount).toBe(0)
    })

    it('projectEntityToRecord 写入 taskCount；存量记录兜底 0', async () => {
        const entity = new ProjectEntity(
            'p-1',
            '2024-01-01T00:00:00.000Z',
            '2024-01-02T00:00:00.000Z',
            null,
            '项目',
            'more2',
            null,
            null,
            null,
            1,
            7
        )
        const record = await projectEntityToRecord(entity, 'test-user')
        expect(record.taskCount).toBe(7)

        const legacy = { ...record } as Record<string, unknown>
        delete legacy.taskCount
        const restored = await projectRecordToEntity(legacy as unknown as ProjectRecord)
        expect(restored.taskCount).toBe(0)
    })
})