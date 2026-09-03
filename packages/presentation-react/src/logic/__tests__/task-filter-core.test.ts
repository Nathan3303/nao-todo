import { describe, expect, it } from 'vite-plus/test'
import type { TaskViewObject } from '@nao-todo/domain-task'
import {
    BUILTIN_LIST_IDS,
    filterTasksByStatePriority,
    filterTasksByView,
    getBuiltInListTasksOptions,
    getProjectListTasksOptions,
    getSortedTasks,
    getTagListTasksOptions,
    mergeListOptions,
    taskPriorityLocaleKey,
    taskStateLocaleKey
} from '../task-filter-core'

/** 构造任务（默认 todo/未删/未弃/未收藏/无项目无标签） */
const makeTask = (overrides: Partial<TaskViewObject> = {}): TaskViewObject =>
    ({
        id: 't1',
        userId: 'u1',
        parentTaskId: null,
        name: '任务',
        description: '',
        state: 'todo',
        priority: 'medium',
        startAt: null,
        endAt: null,
        projectId: null,
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        starMarkAt: null,
        givenUpAt: null,
        archivedAt: null,
        remindAt: null,
        remindRepeat: 'none',
        remindTime: null,
        remindWeekdays: [],
        isDeleted: false,
        isArchived: false,
        isStarMarked: false,
        isGivenUp: false,
        ...overrides
    }) as TaskViewObject

/** 今天的 0 点 / 现在 ISO */
const inToday = (): string => new Date().toISOString()
const inTomorrow = (): string => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString()
}

describe('taskFilterCore - 清单查询选项（对齐 Web 默认偏好）', () => {
    it('内建清单覆盖 Web defaultBuiltInProjectPreferences 的查询选项', () => {
        expect(BUILTIN_LIST_IDS).toEqual([
            'all',
            'today',
            'tomorrow',
            'week',
            'inbox',
            'favourite',
            'overdue',
            'givenup',
            'deleted'
        ])
        expect(getBuiltInListTasksOptions('today')).toEqual({
            relativeDate: 'today',
            limit: 20,
            isGivenUp: false
        })
        expect(getBuiltInListTasksOptions('deleted')).toEqual({
            isDeleted: true,
            sort: { field: 'deletedAt', order: 'desc' },
            limit: 20,
            isGivenUp: false
        })
    })

    it('未知清单回退到「所有任务」', () => {
        expect(getBuiltInListTasksOptions('not-exist')).toEqual({
            limit: 20,
            isGivenUp: false
        })
    })

    it('项目/标签清单', () => {
        expect(getProjectListTasksOptions('p1')).toEqual({
            projectId: 'p1',
            limit: 20,
            isGivenUp: false,
            isDeleted: false
        })
        expect(getTagListTasksOptions('tag-1')).toEqual({
            tagId: 'tag-1',
            limit: 20,
            isGivenUp: false,
            isDeleted: false
        })
    })
})

describe('taskFilterCore - 前端兜底过滤（幂等双保险）', () => {
    it('today：结束日期在今天及之后（对齐 Web matchRelativeDate）', () => {
        const tasks = [
            makeTask({ id: 'a', endAt: inToday() }),
            makeTask({ id: 'b', endAt: inTomorrow() }),
            makeTask({ id: 'c', endAt: null }),
            makeTask({ id: 'd', startAt: inToday(), endAt: null })
        ]
        const result = filterTasksByView(tasks, { builtinId: 'today' })
        // a/b：endAt 今天及之后；c/d：无 endAt 不匹配（正向条件）
        expect(result.map((t) => t.id)).toEqual(['a', 'b'])
    })

    it('tomorrow / week（endAt 判定）', () => {
        const tasks = [
            makeTask({ id: 'a', endAt: inToday() }),
            makeTask({ id: 'b', endAt: inTomorrow() })
        ]
        expect(filterTasksByView(tasks, { builtinId: 'tomorrow' }).map((t) => t.id)).toEqual(['b'])
        // week：今日任务也落在本周
        expect(filterTasksByView(tasks, { builtinId: 'week' }).map((t) => t.id)).toEqual(['a', 'b'])
    })

    it('overdue：结束日期早于今日零点且未完成；无截止时间保留', () => {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const tasks = [
            makeTask({ id: 'a', state: 'todo', endAt: yesterday.toISOString() }),
            makeTask({ id: 'b', state: 'done', endAt: yesterday.toISOString() }),
            makeTask({ id: 'c', state: 'todo', endAt: inTomorrow() }),
            makeTask({ id: 'd', state: 'todo', endAt: null })
        ]
        // a：过期未完成；d：无截止时间保留（对齐 Web 负向条件）
        expect(filterTasksByView(tasks, { builtinId: 'overdue' }).map((t) => t.id)).toEqual([
            'a',
            'd'
        ])
    })

    it('inbox / favourite / deleted / givenup / all', () => {
        const tasks = [
            makeTask({ id: 'a', projectId: 'inbox' }),
            makeTask({ id: 'b', isStarMarked: true }),
            makeTask({ id: 'c', isDeleted: true }),
            makeTask({ id: 'd', isGivenUp: true }),
            makeTask({ id: 'e' })
        ]
        expect(filterTasksByView(tasks, { builtinId: 'inbox' }).map((t) => t.id)).toEqual(['a'])
        expect(filterTasksByView(tasks, { builtinId: 'favourite' }).map((t) => t.id)).toEqual(['b'])
        expect(filterTasksByView(tasks, { builtinId: 'deleted' }).map((t) => t.id)).toEqual(['c'])
        expect(filterTasksByView(tasks, { builtinId: 'givenup' }).map((t) => t.id)).toEqual(['d'])
        expect(filterTasksByView(tasks, { builtinId: 'all' }).map((t) => t.id)).toEqual([
            'a',
            'b',
            'e'
        ])
    })

    it('projectId 相等 / tagId 包含', () => {
        const tasks = [
            makeTask({ id: 'a', projectId: 'p1', tags: ['tag-1'] }),
            makeTask({ id: 'b', projectId: 'p2', tags: ['tag-1'] }),
            makeTask({ id: 'c', projectId: 'p1', tags: [] })
        ]
        expect(filterTasksByView(tasks, { projectId: 'p1' }).map((t) => t.id)).toEqual(['a', 'c'])
        expect(filterTasksByView(tasks, { tagId: 'tag-1' }).map((t) => t.id)).toEqual(['a', 'b'])
        // 已删除的不进项目/标签视图
        const withDeleted = [makeTask({ id: 'd', projectId: 'p1', isDeleted: true }), ...tasks]
        expect(filterTasksByView(withDeleted, { projectId: 'p1' }).map((t) => t.id)).toEqual([
            'a',
            'c'
        ])
    })

    it('无作用域回退「今日任务」', () => {
        const tasks = [makeTask({ id: 'a', endAt: inToday() }), makeTask({ id: 'b' })]
        expect(filterTasksByView(tasks, {}).map((t) => t.id)).toEqual(['a'])
    })
})

describe('taskFilterCore - 状态 i18n 键映射', () => {
    it('in-progress 映射驼峰键（回归：显示 task.state.in-progress）', () => {
        expect(taskStateLocaleKey('in-progress')).toBe('task.state.inProgress')
    })

    it('todo / done 与值一致', () => {
        expect(taskStateLocaleKey('todo')).toBe('task.state.todo')
        expect(taskStateLocaleKey('done')).toBe('task.state.done')
    })

    it('taskPriorityLocaleKey：白名单一致，未知值回退 none', () => {
        expect(taskPriorityLocaleKey('high')).toBe('task.priority.high')
        expect(taskPriorityLocaleKey('medium')).toBe('task.priority.medium')
        expect(taskPriorityLocaleKey('low')).toBe('task.priority.low')
        expect(taskPriorityLocaleKey('none')).toBe('task.priority.none')
        expect(taskPriorityLocaleKey('unknown-value')).toBe('task.priority.none')
    })
})

describe('taskFilterCore - 排序 / 筛选（Web filter-dropdown 参数）', () => {
    it('getSortedTasks：时间字段升/降序，空值排末', () => {
        const tasks = [
            makeTask({ id: 'a', createdAt: '2026-06-01T00:00:00Z' }),
            makeTask({ id: 'b', createdAt: '2026-06-03T00:00:00Z' }),
            makeTask({ id: 'c', createdAt: '' })
        ]
        expect(
            getSortedTasks(tasks, { field: 'createdAt', order: 'asc' }).map((t) => t.id)
        ).toEqual(['a', 'b', 'c'])
        expect(
            getSortedTasks(tasks, { field: 'createdAt', order: 'desc' }).map((t) => t.id)
        ).toEqual(['b', 'a', 'c'])
    })

    it('getSortedTasks：endAt 空值排末；priority 高→低', () => {
        const tasks = [
            makeTask({ id: 'a', endAt: null }),
            makeTask({ id: 'b', endAt: '2026-06-01T00:00:00Z' }),
            makeTask({ id: 'c', endAt: '2026-06-05T00:00:00Z' })
        ]
        expect(getSortedTasks(tasks, { field: 'endAt', order: 'asc' }).map((t) => t.id)).toEqual([
            'b',
            'c',
            'a'
        ])
        const byPriority = [
            makeTask({ id: 'a', priority: 'low' }),
            makeTask({ id: 'b', priority: 'high' }),
            makeTask({ id: 'c', priority: 'medium' })
        ]
        expect(
            getSortedTasks(byPriority, { field: 'priority', order: 'desc' }).map((t) => t.id)
        ).toEqual(['b', 'c', 'a'])
    })

    it('filterTasksByStatePriority：空串为「全部」', () => {
        const tasks = [
            makeTask({ id: 'a', state: 'todo', priority: 'high' }),
            makeTask({ id: 'b', state: 'done', priority: 'high' }),
            makeTask({ id: 'c', state: 'todo', priority: 'low' })
        ]
        expect(filterTasksByStatePriority(tasks, 'todo', '').map((t) => t.id)).toEqual(['a', 'c'])
        expect(filterTasksByStatePriority(tasks, '', 'high').map((t) => t.id)).toEqual(['a', 'b'])
        expect(filterTasksByStatePriority(tasks, '', '').map((t) => t.id)).toEqual(['a', 'b', 'c'])
        expect(filterTasksByStatePriority(tasks, 'todo', 'low').map((t) => t.id)).toEqual(['c'])
    })

    it('mergeListOptions：合并 sort/state/priority/隐藏已完成', () => {
        const base = { limit: 20, isGivenUp: false }
        expect(mergeListOptions(base, { sort: { field: 'endAt', order: 'desc' } })).toEqual({
            limit: 20,
            isGivenUp: false,
            sort: { field: 'endAt', order: 'desc' }
        })
        expect(mergeListOptions(base, { state: 'todo', priority: 'high' })).toEqual({
            limit: 20,
            isGivenUp: false,
            state: 'todo',
            priority: 'high'
        })
        // 空值剔除
        expect(mergeListOptions(base, { state: '', priority: '' })).toEqual({
            limit: 20,
            isGivenUp: false
        })
        // 隐藏已完成：state 排除 done
        expect(mergeListOptions(base, { isHideCompleted: true })).toEqual({
            limit: 20,
            isGivenUp: false,
            state: 'todo,in-progress'
        })
        expect(mergeListOptions(base, { state: 'todo', isHideCompleted: true })).toEqual({
            limit: 20,
            isGivenUp: false,
            state: 'todo'
        })
        expect(mergeListOptions(base, { state: 'done', isHideCompleted: true })).toEqual({
            limit: 20,
            isGivenUp: false,
            state: 'todo,in-progress'
        })
    })
})