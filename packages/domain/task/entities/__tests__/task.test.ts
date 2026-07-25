import { describe, it, expect } from 'vite-plus/test'
import { TaskEntity } from '../task'

/**
 * TaskEntity 构造函数参数顺序（20 个位置参数）：
 * id, createdAt, updatedAt, deletedAt, parentTaskId, name, description,
 * state, priority, startAt, endAt, projectId, tags, archivedAt, starMarkAt,
 * givenUpAt, remindAt, remindRepeat, remindTime, remindWeekdays
 */
const makeEntity = (overrides: Partial<Record<string, unknown>> = {}): TaskEntity => {
    const base = {
        id: 'task-1',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        deletedAt: null as string | null,
        parentTaskId: '',
        name: '测试任务',
        description: '描述',
        state: 'todo',
        priority: 'low',
        startAt: '2024-01-01T00:00:00.000Z',
        endAt: '2024-01-03T00:00:00.000Z',
        projectId: 'project-1',
        tags: [] as string[],
        archivedAt: null as string | null,
        starMarkAt: null as string | null,
        givenUpAt: null as string | null,
        remindAt: '',
        remindRepeat: 'none',
        remindTime: '',
        remindWeekdays: [] as number[]
    }
    const v = { ...base, ...overrides }
    return new TaskEntity(
        v.id as string,
        v.createdAt as string,
        v.updatedAt as string,
        v.deletedAt as string | null,
        v.parentTaskId as string,
        v.name as string,
        v.description as string,
        v.state as string,
        v.priority as string,
        v.startAt as string,
        v.endAt as string,
        v.projectId as string,
        v.tags as string[],
        v.archivedAt as string | null,
        v.starMarkAt as string | null,
        v.givenUpAt as string | null,
        v.remindAt as string,
        v.remindRepeat as string,
        v.remindTime as string,
        v.remindWeekdays as number[]
    )
}

describe('TaskEntity.isGivenUp', () => {
    it('givenUpAt 为 null 时返回 false', () => {
        expect(makeEntity({ givenUpAt: null }).isGivenUp).toBe(false)
    })
    it('givenUpAt 为空字符串时返回 false', () => {
        expect(makeEntity({ givenUpAt: '' }).isGivenUp).toBe(false)
    })
    it('givenUpAt 为非法日期时返回 false', () => {
        expect(makeEntity({ givenUpAt: 'not-a-date' }).isGivenUp).toBe(false)
    })
    it('givenUpAt 为合法日期时返回 true', () => {
        expect(makeEntity({ givenUpAt: '2024-01-05T00:00:00.000Z' }).isGivenUp).toBe(true)
    })
})

describe('TaskEntity.isArchived', () => {
    it('archivedAt 为 null 时返回 false', () => {
        expect(makeEntity({ archivedAt: null }).isArchived).toBe(false)
    })
    it('archivedAt 为非法日期时返回 false', () => {
        expect(makeEntity({ archivedAt: 'not-a-date' }).isArchived).toBe(false)
    })
    it('archivedAt 为合法日期时返回 true', () => {
        expect(makeEntity({ archivedAt: '2024-01-05T00:00:00.000Z' }).isArchived).toBe(true)
    })
})

describe('TaskEntity.isStarMarked', () => {
    it('starMarkAt 为 null 时返回 false', () => {
        expect(makeEntity({ starMarkAt: null }).isStarMarked).toBe(false)
    })
    it('starMarkAt 为非法日期时返回 false', () => {
        expect(makeEntity({ starMarkAt: 'not-a-date' }).isStarMarked).toBe(false)
    })
    it('starMarkAt 为合法日期时返回 true', () => {
        expect(makeEntity({ starMarkAt: '2024-01-05T00:00:00.000Z' }).isStarMarked).toBe(true)
    })
})

describe('TaskEntity 继承自 Entity', () => {
    it('isDeleted 由基类根据 deletedAt 判定', () => {
        expect(makeEntity({ deletedAt: null }).isDeleted()).toBe(false)
        expect(makeEntity({ deletedAt: '2024-01-05T00:00:00.000Z' }).isDeleted()).toBe(true)
    })
})