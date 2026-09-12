import { describe, it, expect } from 'vite-plus/test'
import { UpdateTaskValueObject } from '@nao-todo/domain-task'
import { taskRes2TaskEntity, updateTaskValueObject2Req } from '../converters'
import type { TaskRes } from '../../models'

describe('updateTaskValueObject2Req - description 透传', () => {
    it('description 为空串时透传（清空描述）', () => {
        const updateVO = new UpdateTaskValueObject('task-1')
        updateVO.description = ''
        const req = updateTaskValueObject2Req(updateVO)
        expect(req.description).toBe('')
    })

    it('未设置 description 时请求体不包含该字段', () => {
        const updateVO = new UpdateTaskValueObject('task-1')
        const req = updateTaskValueObject2Req(updateVO)
        expect(req.description).toBeUndefined()
    })
})

describe('updateTaskValueObject2Req - parentTaskId 空串透传（脱离父任务）', () => {
    it('parentTaskId 为空串时透传（脱离父任务/回到顶层）', () => {
        const updateVO = new UpdateTaskValueObject('task-1')
        updateVO.parentTaskId = ''
        const req = updateTaskValueObject2Req(updateVO)
        expect(req.parentTaskId).toBe('')
    })

    it('未设置 parentTaskId 时请求体不包含该字段', () => {
        const updateVO = new UpdateTaskValueObject('task-1')
        const req = updateTaskValueObject2Req(updateVO)
        expect(req.parentTaskId).toBeUndefined()
    })
})

describe('taskRes2TaskEntity - 领域统计属性映射（U-C1）', () => {
    const baseRes = {
        id: 't-1',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        deletedAt: null,
        parentTaskId: '',
        name: '任务',
        description: '',
        state: 'todo',
        priority: 'medium',
        startAt: '',
        endAt: '',
        tags: [],
        projectId: 'p-1',
        archivedAt: null,
        starMarkAt: null,
        givenUpAt: null,
        remindAt: null,
        remindRepeat: 'none',
        remindTime: null,
        remindWeekdays: [],
        checkItemCount: 3,
        commentCount: 2,
        subtaskCount: 1
    }

    it('映射计数到实体尾部字段', () => {
        const entity = taskRes2TaskEntity(baseRes as unknown as TaskRes)
        expect(entity.checkItemCount).toBe(3)
        expect(entity.commentCount).toBe(2)
        expect(entity.subtaskCount).toBe(1)
    })

    it('字段缺失（旧服务端响应）兜底 0', () => {
        const legacy = { ...baseRes } as Record<string, unknown>
        delete legacy.checkItemCount
        delete legacy.commentCount
        delete legacy.subtaskCount
        const entity = taskRes2TaskEntity(legacy as unknown as TaskRes)
        expect(entity.checkItemCount).toBe(0)
        expect(entity.commentCount).toBe(0)
        expect(entity.subtaskCount).toBe(0)
    })
})