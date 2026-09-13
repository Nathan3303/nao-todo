import { describe, it, expect } from 'vite-plus/test'
import { projectRes2Entity } from '../converters'
import type { ProjectRes } from '../../models'

describe('projectRes2Entity - 领域统计属性映射（U-C1）', () => {
    const baseRes = {
        id: 'p-1',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        deletedAt: null,
        name: '项目',
        description: '描述',
        sortId: 1,
        archivedAt: null,
        deactivedAt: null,
        taskCount: 7
    }

    it('映射 taskCount 到实体尾部字段', () => {
        const entity = projectRes2Entity(baseRes as ProjectRes)
        expect(entity.taskCount).toBe(7)
    })

    it('字段缺失（旧服务端响应）兜底 0', () => {
        const legacy = { ...baseRes } as Record<string, unknown>
        delete legacy.taskCount
        const entity = projectRes2Entity(legacy as unknown as ProjectRes)
        expect(entity.taskCount).toBe(0)
    })
})