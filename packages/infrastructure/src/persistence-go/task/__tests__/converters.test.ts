import { describe, it, expect } from 'vite-plus/test'
import { UpdateTaskValueObject } from '@nao-todo/domain-task'
import { updateTaskValueObject2Req } from '../converters'

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