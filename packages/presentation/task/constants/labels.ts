import { computed } from 'vue'
import { t, type TaskColumnOptions } from '@nao-todo/shared'
import type { TaskSortFields } from '@nao-todo/domain-task'

/**
 * 待办事项状态下拉选项
 * @description UI 表现物，随 locale 变化自动重算
 */
export const TaskStateSelectOptions = computed(() => [
    { label: t('task.state.todo'), value: 'todo', icon: 'circle' },
    { label: t('task.state.inProgress'), value: 'in-progress', icon: 'in-progress' },
    { label: t('task.state.done'), value: 'done', icon: 'success' }
])

/**
 * 待办事项优先级下拉选项
 * @description UI 表现物，随 locale 变化自动重算
 */
export const TaskPrioritySelectOptions = computed(() => [
    { label: t('task.priority.low'), value: 'low', icon: 'priority-1' },
    { label: t('task.priority.medium'), value: 'medium', icon: 'priority-2' },
    { label: t('task.priority.high'), value: 'high', icon: 'priority-3' }
])

/**
 * 待办事项列标签映射
 * @description UI 表现物，随 locale 变化自动重算
 */
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

/**
 * 待办事项排序字段标签映射
 * @description UI 表现物，随 locale 变化自动重算
 */
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