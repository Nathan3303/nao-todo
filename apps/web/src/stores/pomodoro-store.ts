import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PomodoroRecordViewObject } from '@/components/pomodoro/timer/types'

const usePomodoroStore = defineStore('PomodoroStore', () => {
    // @state 当前关联任务 ID
    const currentTaskId = ref<string | null>(null)

    // @state 当前关联任务名称
    const currentTaskName = ref('')

    // @state 当前专注记录 ID（focus 开始时由 nanoid 生成）
    const currentRecordId = ref<string | null>(null)

    // @state 当前专注记录开始时间（ISO 8601）
    const currentRecordStartAt = ref<string | null>(null)

    // @state 专注记录列表
    const records = ref<PomodoroRecordViewObject[]>([])

    // @state 当前笔记文本
    const noteText = ref('')

    // @state 专注时长（秒）
    const focusDuration = ref(25 * 60)

    // @state 短休息时长（秒）
    const breakDuration = ref(5 * 60)

    // @state 长休息时长（秒）
    const longBreakDuration = ref(15 * 60)

    // @state 触发长休息所需的专注次数
    const sessionsUntilLongBreak = ref(4)

    // @state 自动开始下一轮专注
    const autoStartNextFocusSession = ref(false)

    // @state 自动开始专注次数
    const autoStartNextFocusSessionCount = ref(4)

    // @state 自动休息
    const autoRest = ref(true)

    // @action 选择专注任务（由 selectTask 事件触发）
    const selectTask = (taskId: string | null, taskName: string) => {
        currentTaskId.value = taskId
        currentTaskName.value = taskName
    }

    // @action 设置当前会话
    const setCurrentSession = (
        taskId: string | null,
        taskName: string,
        recordId: string,
        startAt: string
    ) => {
        currentTaskId.value = taskId
        currentTaskName.value = taskName
        currentRecordId.value = recordId
        currentRecordStartAt.value = startAt
    }

    // @action 清除当前会话
    const clearCurrentSession = () => {
        currentTaskId.value = null
        currentTaskName.value = ''
        currentRecordId.value = null
        currentRecordStartAt.value = null
        noteText.value = ''
    }

    // @action 添加专注记录
    const addRecord = (record: PomodoroRecordViewObject) => {
        records.value.push(record)
    }

    // @action 更新记录笔记
    const updateNote = (recordId: string, note: string) => {
        const record = records.value.find((r) => r.id === recordId)
        if (record) {
            record.note = note
        }
    }

    // @action 设置笔记文本
    const setNoteText = (text: string) => {
        noteText.value = text
    }

    // @action 设置专注时长
    const setFocusDuration = (seconds: number) => {
        focusDuration.value = seconds
    }

    // @action 设置短休息时长
    const setBreakDuration = (seconds: number) => {
        breakDuration.value = seconds
    }

    // @action 设置长休息时长
    const setLongBreakDuration = (seconds: number) => {
        longBreakDuration.value = seconds
    }

    // @action 设置触发长休息所需的专注次数
    const setSessionsUntilLongBreak = (n: number) => {
        sessionsUntilLongBreak.value = n
    }

    // @action 设置自动开始下一轮专注
    const setAutoStartNextFocusSession = (value: boolean) => {
        autoStartNextFocusSession.value = value
    }

    // @action 设置自动开始专注次数
    const setAutoStartNextFocusSessionCount = (n: number) => {
        autoStartNextFocusSessionCount.value = n
    }

    // @action 设置自动休息
    const setAutoRest = (value: boolean) => {
        autoRest.value = value
    }

    return {
        currentTaskId,
        currentTaskName,
        currentRecordId,
        currentRecordStartAt,
        records,
        noteText,
        focusDuration,
        breakDuration,
        longBreakDuration,
        sessionsUntilLongBreak,
        selectTask,
        setCurrentSession,
        clearCurrentSession,
        addRecord,
        updateNote,
        setNoteText,
        setFocusDuration,
        setBreakDuration,
        setLongBreakDuration,
        setSessionsUntilLongBreak,
        autoStartNextFocusSession,
        autoStartNextFocusSessionCount,
        autoRest,
        setAutoStartNextFocusSession,
        setAutoStartNextFocusSessionCount,
        setAutoRest
    }
})

export default usePomodoroStore

