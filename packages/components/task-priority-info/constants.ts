import { computed } from 'vue'
import { t } from '@nao-todo/infrastructure/locales'

export const TaskPriorityPresets = computed(() => ({
    urgent: ['priority-3', t('task.priority.high'), 'red'] as [string, string, string],
    high: ['priority-3', t('task.priority.high'), 'red'] as [string, string, string],
    medium: ['priority-2', t('task.priority.medium'), 'orange'] as [string, string, string],
    low: ['priority-1', t('task.priority.low'), '#6363ff'] as [string, string, string],
    none: ['priority-1', t('task.priority.none'), 'gray'] as [string, string, string],
}))
