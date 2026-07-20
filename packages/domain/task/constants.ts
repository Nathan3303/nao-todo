import { type TaskColumnOptions, t } from '@nao-todo/shared'
import { computed } from 'vue'
import type { TaskSortFields } from './types'

// 待办事项状态选项
export const TaskStateSelectOptions = computed(() => [
    { label: t('task.state.todo'), value: 'todo', icon: 'circle' },
    { label: t('task.state.inProgress'), value: 'in-progress', icon: 'in-progress' },
    { label: t('task.state.done'), value: 'done', icon: 'success' }
])

// 待办事项优先级选项
export const TaskPrioritySelectOptions = computed(() => [
    { label: t('task.priority.low'), value: 'low', icon: 'priority-1' },
    { label: t('task.priority.medium'), value: 'medium', icon: 'priority-2' },
    { label: t('task.priority.high'), value: 'high', icon: 'priority-3' }
])

// 待办事项列标签映射
export const columnLabels = computed<Record<keyof TaskColumnOptions, string>>(() => ({
    name: t('task.column.name'),
    description: t('task.column.description'),
    state: t('task.column.state'),
    priority: t('task.column.priority'),
    startAt: t('task.column.startAt'),
    endAt: t('task.column.endAt'),
    project: t('task.column.project'),
    tags: t('task.column.tags'),
    givenUpAt: t('task.column.givenUpAt'),
    starMarkAt: t('task.column.starMarkAt'),
    archivedAt: t('task.column.archivedAt'),
    createdAt: t('task.column.createdAt'),
    updatedAt: t('task.column.updatedAt'),
    deletedAt: t('task.column.deletedAt')
}))

// 待办事项排序字段标签映射
export const sortFieldLabels = computed<Record<keyof TaskSortFields, string>>(() => ({
    name: t('task.column.name'),
    state: t('task.column.state'),
    priority: t('task.column.priority'),
    startAt: t('task.column.startAt'),
    endAt: t('task.column.endAt'),
    tags: t('task.column.tags'),
    givenUpAt: t('task.column.givenUpAt'),
    starMarkAt: t('task.column.starMarkAt'),
    archivedAt: t('task.column.archivedAt'),
    createdAt: t('task.column.createdAt'),
    updatedAt: t('task.column.updatedAt'),
    deletedAt: t('task.column.deletedAt')
}))

// 待办事项状态序列号映射
export const stateSNMap = { todo: 1, 'in-progress': 2, doing: 2, done: 3 }

// 待办事项状态选项的反向映射
export const stateSNMapReverse = [null, 'todo', 'in-progress', 'done']

// 待办事项优先级序列号映射
export const prioritySNMap = { low: 1, medium: 2, high: 3 }

// 待办事项优先级选项的反向映射
export const prioritySNMapReverse = [null, 'low', 'medium', 'high']

