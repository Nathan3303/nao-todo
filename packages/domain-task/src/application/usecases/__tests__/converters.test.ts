import { describe, it, expect } from 'vite-plus/test'
import { TaskEntity } from '@nao-todo/domain-task'
import {
    taskEntityToViewObject,
    taskEntitiesToViewObjects,
    updateTaskViewObjectToValueObject
} from '../converters'

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
        tags: ['tag-1'] as string[],
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

describe('taskEntityToViewObject - 字段映射', () => {
    it('应映射所有基础字段', () => {
        const vo = taskEntityToViewObject(makeEntity())
        expect(vo.id).toBe('task-1')
        expect(vo.parentTaskId).toBe('')
        expect(vo.name).toBe('测试任务')
        expect(vo.description).toBe('描述')
        expect(vo.projectId).toBe('project-1')
        expect(vo.tags).toEqual(['tag-1'])
        expect(vo.startAt).toBe('2024-01-01T00:00:00.000Z')
        expect(vo.endAt).toBe('2024-01-03T00:00:00.000Z')
        expect(vo.createdAt).toBe('2024-01-01T00:00:00.000Z')
        expect(vo.updatedAt).toBe('2024-01-02T00:00:00.000Z')
        expect(vo.deletedAt).toBeNull()
        expect(vo.archivedAt).toBeNull()
        expect(vo.starMarkAt).toBeNull()
        expect(vo.givenUpAt).toBeNull()
    })
})

describe('taskEntityToViewObject - state 合法化', () => {
    it('合法 state 原样保留', () => {
        expect(taskEntityToViewObject(makeEntity({ state: 'todo' })).state).toBe('todo')
        expect(taskEntityToViewObject(makeEntity({ state: 'in-progress' })).state).toBe(
            'in-progress'
        )
        expect(taskEntityToViewObject(makeEntity({ state: 'done' })).state).toBe('done')
    })

    it('非法 state 回退为 todo', () => {
        expect(taskEntityToViewObject(makeEntity({ state: 'garbage' })).state).toBe('todo')
        expect(taskEntityToViewObject(makeEntity({ state: '' })).state).toBe('todo')
    })
})

describe('taskEntityToViewObject - priority 合法化', () => {
    it('合法 priority 原样保留', () => {
        expect(taskEntityToViewObject(makeEntity({ priority: 'low' })).priority).toBe('low')
        expect(taskEntityToViewObject(makeEntity({ priority: 'medium' })).priority).toBe('medium')
        expect(taskEntityToViewObject(makeEntity({ priority: 'high' })).priority).toBe('high')
    })

    it('非法 priority 回退为 low', () => {
        expect(taskEntityToViewObject(makeEntity({ priority: 'urgent' })).priority).toBe('low')
        expect(taskEntityToViewObject(makeEntity({ priority: '' })).priority).toBe('low')
    })
})

describe('taskEntityToViewObject - 派生布尔（充血改造锁定点）', () => {
    it('isGivenUp: givenUpAt 为合法日期时 true', () => {
        expect(taskEntityToViewObject(makeEntity({ givenUpAt: null })).isGivenUp).toBe(false)
        expect(
            taskEntityToViewObject(makeEntity({ givenUpAt: '2024-01-05T00:00:00.000Z' })).isGivenUp
        ).toBe(true)
        expect(taskEntityToViewObject(makeEntity({ givenUpAt: '' })).isGivenUp).toBe(false)
        expect(taskEntityToViewObject(makeEntity({ givenUpAt: 'not-a-date' })).isGivenUp).toBe(
            false
        )
    })

    it('isArchived: archivedAt 为合法日期时 true', () => {
        expect(taskEntityToViewObject(makeEntity({ archivedAt: null })).isArchived).toBe(false)
        expect(
            taskEntityToViewObject(makeEntity({ archivedAt: '2024-01-05T00:00:00.000Z' }))
                .isArchived
        ).toBe(true)
        expect(taskEntityToViewObject(makeEntity({ archivedAt: 'not-a-date' })).isArchived).toBe(
            false
        )
    })

    it('isStarMarked: starMarkAt 为合法日期时 true', () => {
        expect(taskEntityToViewObject(makeEntity({ starMarkAt: null })).isStarMarked).toBe(false)
        expect(
            taskEntityToViewObject(makeEntity({ starMarkAt: '2024-01-05T00:00:00.000Z' }))
                .isStarMarked
        ).toBe(true)
        expect(taskEntityToViewObject(makeEntity({ starMarkAt: 'not-a-date' })).isStarMarked).toBe(
            false
        )
    })

    it('isDeleted: deletedAt 为合法日期时 true', () => {
        expect(taskEntityToViewObject(makeEntity({ deletedAt: null })).isDeleted).toBe(false)
        expect(
            taskEntityToViewObject(makeEntity({ deletedAt: '2024-01-05T00:00:00.000Z' })).isDeleted
        ).toBe(true)
    })
})

describe('taskEntityToViewObject - 提醒字段默认值', () => {
    it('remindRepeat 为空时回退 none', () => {
        expect(taskEntityToViewObject(makeEntity({ remindRepeat: '' })).remindRepeat).toBe('none')
        expect(taskEntityToViewObject(makeEntity({ remindRepeat: 'daily' })).remindRepeat).toBe(
            'daily'
        )
    })

    it('remindAt / remindTime 为空时回退 null', () => {
        const vo = taskEntityToViewObject(makeEntity({ remindAt: '', remindTime: '' }))
        expect(vo.remindAt).toBeNull()
        expect(vo.remindTime).toBeNull()
    })

    it('remindWeekdays 保留数组', () => {
        expect(
            taskEntityToViewObject(makeEntity({ remindWeekdays: [1, 3, 5] })).remindWeekdays
        ).toEqual([1, 3, 5])
    })
})

describe('taskEntitiesToViewObjects - 批量转换', () => {
    it('保持顺序与长度', () => {
        const entities = [makeEntity({ id: 'a' }), makeEntity({ id: 'b' }), makeEntity({ id: 'c' })]
        const vos = taskEntitiesToViewObjects(entities)
        expect(vos.map((v) => v.id)).toEqual(['a', 'b', 'c'])
    })
})

describe('updateTaskViewObjectToValueObject - starMarkAt 透传', () => {
    it('未设置 starMarkAt 时值对象不包含该字段', () => {
        const vo = updateTaskViewObjectToValueObject('task-1', { name: '改名' })
        expect(vo.starMarkAt).toBeUndefined()
    })
    it('starMarkAt 为合法日期时透传', () => {
        const vo = updateTaskViewObjectToValueObject('task-1', {
            starMarkAt: '2024-01-05T00:00:00.000Z'
        })
        expect(vo.starMarkAt).toBe('2024-01-05T00:00:00.000Z')
    })
    it('starMarkAt 为 null 时透传（取消收藏）', () => {
        const vo = updateTaskViewObjectToValueObject('task-1', { starMarkAt: null })
        expect(vo.starMarkAt).toBeNull()
    })
})

describe('updateTaskViewObjectToValueObject - startAt/endAt 透传', () => {
    it('未设置 startAt/endAt 时值对象不包含该字段', () => {
        const vo = updateTaskViewObjectToValueObject('task-1', { name: '改名' })
        expect(vo.startAt).toBeUndefined()
        expect(vo.endAt).toBeUndefined()
    })
    it('startAt 为合法日期时透传', () => {
        const vo = updateTaskViewObjectToValueObject('task-1', {
            startAt: '2024-01-05T00:00:00.000Z'
        })
        expect(vo.startAt).toBe('2024-01-05T00:00:00.000Z')
    })
    it('startAt 为 null 时透传（清除）', () => {
        const vo = updateTaskViewObjectToValueObject('task-1', { startAt: null })
        expect(vo.startAt).toBeNull()
    })
    it('endAt 为 null 时透传（清除）', () => {
        const vo = updateTaskViewObjectToValueObject('task-1', { endAt: null })
        expect(vo.endAt).toBeNull()
    })
})