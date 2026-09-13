import { describe, it, expect } from 'vite-plus/test'
import { ProjectEntity } from '@nao-todo/domain-project'
import { projectEntityToViewObject } from '../converters'

describe('projectEntityToViewObject - 领域统计属性透传（U-C2）', () => {
    it('taskCount 透传到视图对象', () => {
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
        const vo = projectEntityToViewObject(entity)
        expect(vo.taskCount).toBe(7)
    })

    it('未传 taskCount（既有构造）默认 0 并透传', () => {
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
            1
        )
        expect(entity.taskCount).toBe(0)
        expect(projectEntityToViewObject(entity).taskCount).toBe(0)
    })
})