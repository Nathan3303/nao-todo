import type { TaskColumnOptions, TaskSortFields } from '@nao-todo/types'

/**
 * 待办事项状态选项
 */
export const TaskStateSelectOptions = [
    { label: '代办', value: 'todo', icon: 'circle' },
    { label: '正在进行', value: 'in-progress', icon: 'in-progress' },
    { label: '已完成', value: 'done', icon: 'success' }
]

/**
 * 待办事项优先级选项
 */
export const TaskPrioritySelectOptions = [
    { label: '低优先级', value: 'low', icon: 'priority-1' },
    { label: '中优先级', value: 'medium', icon: 'priority-2' },
    { label: '高优先级', value: 'high', icon: 'priority-3' }
]

/**
 * 待办事项列标签映射
 */
export const columnLabels: Record<keyof TaskColumnOptions, string> = {
    name: '名称',
    description: '描述',
    state: '状态',
    priority: '优先级',
    startAt: '开始时间',
    endAt: '结束时间',
    project: '所属清单',
    tags: '标签',
    givenUpAt: '放弃时间',
    starMarkAt: '星标时间',
    archivedAt: '归档时间',
    createdAt: '创建时间',
    updatedAt: '更新时间',
    deletedAt: '删除时间'
}

/**
 * 默认显示的列
 */
export const defaultColumns: Record<keyof TaskColumnOptions, boolean> = {
    name: true,
    description: true,
    state: true,
    priority: true,
    startAt: false,
    endAt: true,
    project: true,
    tags: true,
    givenUpAt: false,
    starMarkAt: false,
    archivedAt: false,
    createdAt: false,
    updatedAt: true,
    deletedAt: false
}

/**
 * 待办事项排序字段标签映射
 */
export const sortFieldLabels: Record<keyof TaskSortFields, string> = {
    name: '名称',
    state: '状态',
    priority: '优先级',
    startAt: '开始时间',
    endAt: '结束时间',
    tags: '标签',
    givenUpAt: '放弃时间',
    starMarkAt: '星标时间',
    archivedAt: '归档时间',
    createdAt: '创建时间',
    updatedAt: '更新时间',
    deletedAt: '删除时间'
}

/**
 * 待办事项状态序列号映射
 */
export const stateSNMap = { todo: 1, 'in-progress': 2, doing: 2, done: 3 }

/**
 * 待办事项状态选项的反向映射
 */
export const stateSNMapReverse = [null, 'todo', 'in-progress', 'done']

/**
 * 待办事项优先级序列号映射
 */
export const prioritySNMap = { low: 1, medium: 2, high: 3 }

/**
 * 待办事项优先级选项的反向映射
 */
export const prioritySNMapReverse = [null, 'low', 'medium', 'high']

