import { unwrapError } from '@nao-todo/shared/utils/user-facing-go-error'
import { type TaskReminderEvent } from '@nao-todo/shared/types'
import { isArchivedReadOnlyError } from '../../../archive-gate'
import { NueMessage } from 'nue-ui'
import { t } from '@nao-todo/shared/locales'
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

/** 认定为「补弹」的滞后阈值（ms）：≥ 1 分钟才标注「原定 …」 */
const LATE_THRESHOLD_MS = 60_000

/** 本地墙钟 `HH:mm`（非法 / 空 ⇒ 空串，不渲染该行） */
const formatClockTime = (remindAt: string | undefined): string => {
    if (!remindAt) return ''
    const timestamp = Date.parse(remindAt)
    if (!Number.isFinite(timestamp)) return ''
    const date = new Date(timestamp)
    const pad = (value: number): string => String(value).padStart(2, '0')
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const useTaskReminder = (props: TaskReminderDialogProps) => {
    const { dialogManager, taskUseCase, onOpenTask, getProjectName, now } = props
    const tasksStore = useTasksStore()
    const nowMs = (): number => (now ? now() : Date.now())

    const queue = ref<TaskReminderEvent[]>([])
    const processedCount = ref(0)
    const totalCount = ref(0)

    const currentEvent = computed(() => queue.value[0] ?? null)
    const currentTask = computed<TaskViewObject | undefined>(() => {
        const e = currentEvent.value
        return e ? tasksStore.getTask(e.taskId) : undefined
    })

    /**
     * 解析清单名（T531/AC8）
     * @description 由装配层注入 `getProjectName` 解析（弹窗不引 router / 仓储）；
     *              解析不到 / 抛错 ⇒ `null`（展示层回退 i18n「清单」文案，不空白、不露 `projectId`）。
     */
    const resolveProjectName = (projectId: string | undefined): string | null => {
        if (!projectId || !getProjectName) return null
        try {
            const name = getProjectName(projectId)
            return typeof name === 'string' && name.trim() !== '' ? name : null
        } catch {
            return null
        }
    }

    const currentProjectName = computed<string>(
        () =>
            resolveProjectName(currentEvent.value?.projectId) ??
            t('dialog.taskReminder.projectFallback')
    )

    /** 原定提醒时刻（本地墙钟 `HH:mm`；事件缺 `remindAt` ⇒ 空串） */
    const currentRemindAtText = computed(() => formatClockTime(currentEvent.value?.remindAt))

    /** 补弹（原定时刻早于当前 ≥1 分钟） */
    const isLateReminder = computed(() => {
        const remindAt = currentEvent.value?.remindAt
        if (!remindAt) return false
        const timestamp = Date.parse(remindAt)
        if (!Number.isFinite(timestamp)) return false
        return nowMs() - timestamp >= LATE_THRESHOLD_MS
    })

    /** 时刻展示文案（补弹时标「原定 …」，避免被误读为刚到期） */
    const remindAtLabel = computed(() =>
        isLateReminder.value && currentRemindAtText.value
            ? `${t('dialog.taskReminder.original')} ${currentRemindAtText.value}`
            : currentRemindAtText.value
    )

    const progressPercent = computed(() =>
        totalCount.value === 0 ? 0 : Math.floor((processedCount.value / totalCount.value) * 100)
    )
    const progressText = computed(
        () => `已处理 ${processedCount.value} 个提醒，剩余 ${queue.value.length} 个`
    )

    const snoozing = ref(false)
    /** 「完成」进行中（AC13：防重入，连续点击只落一次终态） */
    const completing = ref(false)

    const enqueue = (event: TaskReminderEvent) => {
        // 入队即预解析清单名（弹窗打开瞬间不因首次解析而空白；解析失败由展示层重试 / 回退）
        resolveProjectName(event.projectId)
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
            // T193：归档只读码静默（守卫已本地化提示；非该码仍原样透出）
            if (!isArchivedReadOnlyError(snoozeError)) {
                NueMessage.error(unwrapError(snoozeError))
            }
            return
        }
        NueMessage.success('延时提醒已设置', 8000)
        dequeue()
    }

    /**
     * 完成（T531 / AC7 · AC13）
     * @description 三类结果：
     *              ① 成功 ⇒ 写 `state: 'done'` + 出队（后续重复提醒因「已完成被过滤」自然停止）；
     *              ② 失败（本地写 / 网络 / 离线只读）⇒ 提示 + **保留队列**；
     *              ③ 只读（已归档 / 已删除 / 已放弃 / 已被别处完成）⇒ **不写 + 静默出队**（T193 口径）。
     */
    const complete = async (): Promise<void> => {
        if (completing.value) return
        const taskId = currentEvent.value?.taskId
        if (!taskId) return
        completing.value = true
        try {
            const error = await taskUseCase.update(taskId, { state: 'done' })
            if (error === null || isArchivedReadOnlyError(error)) {
                // 成功 / 只读：都出队（只读沿用守卫已给的本地化提示，不再叠加报错）
                dequeue()
                return
            }
            NueMessage.error(unwrapError(error))
        } catch (err) {
            NueMessage.error(unwrapError(err as never))
        } finally {
            completing.value = false
        }
    }

    const confirm = () => {
        dequeue()
    }

    const viewDetail = () => {
        const taskId = currentEvent.value?.taskId
        if (!taskId) return
        // 跳转由装配层注入（AC9）：不引 router，缺失时静默
        onOpenTask?.(taskId)
    }

    return {
        dialogManager,
        queue,
        currentEvent,
        currentTask,
        currentProjectName,
        currentRemindAtText,
        isLateReminder,
        remindAtLabel,
        totalCount,
        processedCount,
        progressPercent,
        progressText,
        snoozing,
        completing,
        enqueue,
        dequeue,
        resetQueue,
        snooze,
        complete,
        confirm,
        viewDetail
    }
}

export default useTaskReminder