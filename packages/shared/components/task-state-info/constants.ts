import { computed } from 'vue'
import { t } from '@nao-todo/shared'

export const TaskStatePresets = computed(() => ({
    todo: ['circle', t('task.state.todo')] as [string, string],
    'in-progress': ['in-progress', t('task.state.inProgress')] as [string, string],
    doing: ['in-progress', t('task.state.inProgress')] as [string, string],
    done: ['success-fill', t('task.state.done')] as [string, string],
}))
