import { describe, it, expect } from 'vite-plus/test'
import { isGivenUpBy, TaskEntity } from '../task'
import { TaskErrorCode } from '../../errors'

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

describe('TaskEntity.star / unstar 行为方法', () => {
    it('star() 将 starMarkAt 置为指定时间并返回 null', () => {
        const entity = makeEntity({ starMarkAt: null })
        expect(entity.star('2024-06-01T00:00:00.000Z')).toBe(null)
        expect(entity.starMarkAt).toBe('2024-06-01T00:00:00.000Z')
        expect(entity.isStarMarked).toBe(true)
    })
    it('star() 不传参时使用当前时间（ISO 8601 合法）', () => {
        const entity = makeEntity({ starMarkAt: null })
        expect(entity.star()).toBe(null)
        expect(entity.isStarMarked).toBe(true)
    })
    it('unstar() 将 starMarkAt 清除为空字符串', () => {
        const entity = makeEntity({ starMarkAt: '2024-06-01T00:00:00.000Z' })
        expect(entity.unstar()).toBe(null)
        expect(entity.starMarkAt).toBe('')
        expect(entity.isStarMarked).toBe(false)
    })
    it('已删除任务 star() 返回 STAR_MARK_FORBIDDEN 且不修改星标', () => {
        const entity = makeEntity({ deletedAt: '2024-01-05T00:00:00.000Z', starMarkAt: null })
        expect(entity.star()).toBe(TaskErrorCode.STAR_MARK_FORBIDDEN)
        expect(entity.starMarkAt).toBeNull()
    })
    it('已归档任务 star() 返回 STAR_MARK_FORBIDDEN', () => {
        const entity = makeEntity({ archivedAt: '2024-01-05T00:00:00.000Z', starMarkAt: null })
        expect(entity.star()).toBe(TaskErrorCode.STAR_MARK_FORBIDDEN)
        expect(entity.starMarkAt).toBeNull()
    })
    it('已删除任务 unstar() 返回 STAR_MARK_FORBIDDEN', () => {
        const entity = makeEntity({ deletedAt: '2024-01-05T00:00:00.000Z' })
        expect(entity.unstar()).toBe(TaskErrorCode.STAR_MARK_FORBIDDEN)
    })
})

describe('TaskEntity 继承自 Entity', () => {
    it('isDeleted 由基类根据 deletedAt 判定', () => {
        expect(makeEntity({ deletedAt: null }).isDeleted).toBe(false)
        expect(makeEntity({ deletedAt: '2024-01-05T00:00:00.000Z' }).isDeleted).toBe(true)
    })
})

describe('isGivenUpBy', () => {
    it('null 返回 false', () => {
        expect(isGivenUpBy(null)).toBe(false)
    })
    it('undefined 返回 false', () => {
        expect(isGivenUpBy(undefined)).toBe(false)
    })
    it('空字符串返回 false', () => {
        expect(isGivenUpBy('')).toBe(false)
    })
    it('非法日期返回 false', () => {
        expect(isGivenUpBy('not-a-date')).toBe(false)
    })
    it('合法日期返回 true', () => {
        expect(isGivenUpBy('2024-01-05T00:00:00.000Z')).toBe(true)
    })
})

describe('TaskEntity.isDone', () => {
    it('state 为 done 时返回 true', () => {
        expect(makeEntity({ state: 'done' }).isDone).toBe(true)
    })
    it('state 为 todo 时返回 false', () => {
        expect(makeEntity({ state: 'todo' }).isDone).toBe(false)
    })
    it('state 为 in-progress 时返回 false', () => {
        expect(makeEntity({ state: 'in-progress' }).isDone).toBe(false)
    })
})

describe('TaskEntity.canSnooze', () => {
    it('正常任务可以延迟提醒', () => {
        expect(makeEntity().canSnooze).toBe(true)
    })
    it('已删除的任务不可延迟提醒', () => {
        expect(makeEntity({ deletedAt: '2024-01-05T00:00:00.000Z' }).canSnooze).toBe(false)
    })
    it('已归档的任务不可延迟提醒', () => {
        expect(makeEntity({ archivedAt: '2024-01-05T00:00:00.000Z' }).canSnooze).toBe(false)
    })
    it('已放弃的任务不可延迟提醒', () => {
        expect(makeEntity({ givenUpAt: '2024-01-05T00:00:00.000Z' }).canSnooze).toBe(false)
    })
})

describe('TaskEntity.validateSnoozeDuration', () => {
    it('下边界 1 分钟通过', () => {
        expect(TaskEntity.validateSnoozeDuration(1)).toBe(null)
    })
    it('上边界 1440 分钟通过', () => {
        expect(TaskEntity.validateSnoozeDuration(1440)).toBe(null)
    })
    it('0 分钟超出范围', () => {
        expect(TaskEntity.validateSnoozeDuration(0)).toBe(
            TaskErrorCode.SNOOZE_DURATION_OUT_OF_RANGE
        )
    })
    it('1441 分钟超出范围', () => {
        expect(TaskEntity.validateSnoozeDuration(1441)).toBe(
            TaskErrorCode.SNOOZE_DURATION_OUT_OF_RANGE
        )
    })
    it('负数超出范围', () => {
        expect(TaskEntity.validateSnoozeDuration(-10)).toBe(
            TaskErrorCode.SNOOZE_DURATION_OUT_OF_RANGE
        )
    })
    it('非整数被拒绝', () => {
        expect(TaskEntity.validateSnoozeDuration(1.5)).toBe(
            TaskErrorCode.SNOOZE_DURATION_NOT_INTEGER
        )
    })
    it('NaN 被拒绝', () => {
        expect(TaskEntity.validateSnoozeDuration(Number.NaN)).toBe(
            TaskErrorCode.SNOOZE_DURATION_NOT_INTEGER
        )
    })
})