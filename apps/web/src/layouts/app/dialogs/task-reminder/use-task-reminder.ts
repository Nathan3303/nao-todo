import { inject, ref } from 'vue'
import { NueMessage } from 'nue-ui'
import { IndexViewContext } from '@/views/index/index-view'
import { INDEX_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import useTasksStore from '@/stores/tasks-store'
import type { SSEReminderEvent, TaskViewObject } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/infrastructure/utils'

export const SNOOZE_OPTIONS = [
    { label: '5分钟', minutes: 5 },
    { label: '10分钟', minutes: 10 },
    { label: '15分钟', minutes: 15 },
    { label: '30分钟', minutes: 30 },
    { label: '1小时', minutes: 60 },
    { label: '2小时', minutes: 120 },
    { label: '明天', minutes: 1440 }
]

const useTaskReminder = () => {
    const { dialogManager, taskUseCase, showTaskDetailsDrawer } =
        inject<IndexViewContext>(INDEX_VIEW_CONTEXT_KEY)!
    const tasksStore = useTasksStore()

    const currentEvent = ref<SSEReminderEvent | null>(null)
    const currentTask = ref<TaskViewObject | undefined>()
    const snoozing = ref(false)

    const loadTask = (payload?: SSEReminderEvent) => {
        currentEvent.value = payload || null
        currentTask.value = payload ? tasksStore.getTask(payload.taskId) : undefined
    }

    const clearTask = () => {
        currentEvent.value = null
        currentTask.value = undefined
    }

    const snooze = async (minutes: number) => {
        const taskId = currentEvent.value?.taskId
        if (!taskId) return
        snoozing.value = true
        const snoozeError = await taskUseCase.snoozeTask(taskId, minutes)
        snoozing.value = false
        if (snoozeError !== null) {
            NueMessage.error(unwrapError(snoozeError))
            return
        }
        NueMessage.success('稍后提醒已设置')
    }

    const viewDetail = () => {
        const taskId = currentEvent.value?.taskId
        if (!taskId) return
        showTaskDetailsDrawer(taskId)
    }

    return {
        dialogManager,
        currentEvent,
        currentTask,
        snoozing,
        loadTask,
        clearTask,
        snooze,
        viewDetail
    }
}

export default useTaskReminder



