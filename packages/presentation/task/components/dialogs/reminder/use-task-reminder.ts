import { unwrapError, type SSEReminderEvent } from '@nao-todo/shared'
import { NueMessage } from 'nue-ui'
import { computed, ref } from 'vue'
import { useTasksStore } from '../../../stores'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { TaskReminderDialogProps } from './type'

export const SNOOZE_OPTIONS = [
    { label: '5分钟', minutes: 5 },
    { label: '10分钟', minutes: 10 },
    { label: '15分钟', minutes: 15 },
    { label: '30分钟', minutes: 30 },
    { label: '1小时', minutes: 60 },
    { label: '2小时', minutes: 120 },
    { label: '明天', minutes: 1440 }
]

const useTaskReminder = (props: TaskReminderDialogProps) => {
    const { dialogManager, taskUseCase } = props
    const tasksStore = useTasksStore()

    const queue = ref<SSEReminderEvent[]>([])
    const processedCount = ref(0)
    const totalCount = ref(0)

    const currentEvent = computed(() => queue.value[0] ?? null)
    const currentTask = computed<TaskViewObject | undefined>(() => {
        const e = currentEvent.value
        return e ? tasksStore.getTask(e.taskId) : undefined
    })

    const progressPercent = computed(() =>
        totalCount.value === 0 ? 0 : Math.floor((processedCount.value / totalCount.value) * 100)
    )
    const progressText = computed(
        () => `已处理 ${processedCount.value} 个提醒，剩余 ${queue.value.length} 个`
    )

    const snoozing = ref(false)

    const enqueue = (event: SSEReminderEvent) => {
        queue.value.push(event)
        totalCount.value++
    }

    const dequeue = () => {
        queue.value.shift()
        processedCount.value++
    }

    const resetQueue = () => {
        queue.value = []
        processedCount.value = 0
        totalCount.value = 0
    }

    const snooze = async (minutes: number) => {
        const taskId = currentEvent.value?.taskId
        if (!taskId) return
        snoozing.value = true
        const snoozeError = await taskUseCase.snooze(taskId, minutes)
        snoozing.value = false
        if (snoozeError !== null) {
            NueMessage.error(unwrapError(snoozeError))
            return
        }
        NueMessage.success('延时提醒已设置', 8000)
        dequeue()
    }

    const confirm = () => {
        dequeue()
    }

    const viewDetail = () => {
        const taskId = currentEvent.value?.taskId
        if (!taskId) return
        // showTaskDetailsDrawer(taskId)
    }

    return {
        dialogManager,
        queue,
        currentEvent,
        currentTask,
        totalCount,
        processedCount,
        progressPercent,
        progressText,
        snoozing,
        enqueue,
        dequeue,
        resetQueue,
        snooze,
        confirm,
        viewDetail
    }
}

export default useTaskReminder