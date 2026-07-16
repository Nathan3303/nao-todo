import { computed } from 'vue'
import { t } from '@nao-todo/infrastructure/locales'

export const TaskPriorityPresets = computed(() => ({
    high: ['priority-3', t('task.priority.high'), 'var(--nue-error-color-60)'],
    medium: ['priority-2', t('task.priority.medium'), 'var(--nue-warning-color-60)'],
    low: ['priority-1', t('task.priority.low'), 'inherit']
}))




