import { computed } from 'vue'
import { t, type LocaleKey } from '@nao-todo/shared/locales'
import { type TaskColumnOptions } from '@nao-todo/shared/constants'
import { TASK_PRIORITIES, type TaskPriority, type TaskSortFields } from '@nao-todo/domain-task'

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
 * 优先级档位呈现元信息（图标 + 文案键）
 * @description **档值与顺序以 domain `TASK_PRIORITIES` 为单一来源**（PRD R1）——本表只补「怎么显示」，
 *              不另写一份枚举（Record 类型 ⇒ 缺档 / 多档由 `vp check` 拦住）。
 */
const TASK_PRIORITY_PRESETS: Record<TaskPriority, { icon: string; labelKey: LocaleKey }> = {
    low: { icon: 'priority-1', labelKey: 'task.priority.low' },
    medium: { icon: 'priority-2', labelKey: 'task.priority.medium' },
    high: { icon: 'priority-3', labelKey: 'task.priority.high' },
    urgent: { icon: 'warning', labelKey: 'task.priority.urgent' }
}

/**
 * 待办事项优先级下拉选项
 * @description UI 表现物，随 locale 变化自动重算；四档含「紧急」（T582）
 */
export const TaskPrioritySelectOptions = computed(() =>
    TASK_PRIORITIES.map((value) => ({
        label: t(TASK_PRIORITY_PRESETS[value].labelKey),
        value,
        icon: TASK_PRIORITY_PRESETS[value].icon
    }))
)

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