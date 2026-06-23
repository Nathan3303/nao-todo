import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
    PomodoroRecordViewObject,
    CreatePomodoroRecordViewObject,
    GoAsync
} from '@nao-todo/types'
import { PomodoroRecordUseCase } from '@nao-todo/application/web/usecases/pomodoro'

/**
 * 番茄钟设置存储键名
 */
const POMODORO_SETTINGS_KEY = 'POMODORO_SETTINGS'

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

    // @computed 专注记录 Map（按 id 索引）
    const recordsMap = computed(() => {
        return new Map(records.value.map((r) => [r.id, r]))
    })

    // @action 获取单条记录
    const getRecord = (id: string) => recordsMap.value.get(id)

    // @action 替换全部记录（首屏加载）
    const setRecords = (newRecords: PomodoroRecordViewObject[]) => {
        records.value = newRecords
    }

    // @action 追加记录（翻页加载，自动去重）
    const addRecords = (newRecords: PomodoroRecordViewObject[]) => {
        newRecords.forEach((record) => {
            if (!recordsMap.value.has(record.id)) {
                records.value.push(record)
            }
        })
    }

    // @usecase Pomodoro 记录用例
    const pomodoroRecordUseCase = PomodoroRecordUseCase.create({
        addRecord: (record) => {
            records.value.push(record)
        },
        addRecords: (newRecords) => {
            newRecords.forEach((record) => {
                if (!recordsMap.value.has(record.id)) {
                    records.value.push(record)
                }
            })
        }
    })

    // 记录创建成功后的回调（由 use-timer-page 设置，用于 Subscriber 通知）
    let onRecordCreated: ((record: PomodoroRecordViewObject) => void) | null = null

    const setOnRecordCreated = (cb: ((record: PomodoroRecordViewObject) => void) | null) => {
        onRecordCreated = cb
    }

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

    /**
     * 从 localStorage 加载已保存的番茄钟设置
     */
    const loadSavedSettings = () => {
        try {
            const saved = localStorage.getItem(POMODORO_SETTINGS_KEY)
            if (!saved) return

            const data = JSON.parse(saved)

            // 验证并加载专注时长
            if (
                typeof data.focusDuration === 'number' &&
                data.focusDuration >= 300 &&
                data.focusDuration <= 10800
            ) {
                focusDuration.value = data.focusDuration
            }

            // 验证并加载短休息时长
            if (
                typeof data.breakDuration === 'number' &&
                data.breakDuration >= 60 &&
                data.breakDuration <= 3600
            ) {
                breakDuration.value = data.breakDuration
            }

            // 验证并加载长休息时长
            if (
                typeof data.longBreakDuration === 'number' &&
                data.longBreakDuration >= 60 &&
                data.longBreakDuration <= 3600
            ) {
                longBreakDuration.value = data.longBreakDuration
            }

            // 验证并加载长休息触发轮数
            if (
                typeof data.sessionsUntilLongBreak === 'number' &&
                data.sessionsUntilLongBreak >= 1 &&
                data.sessionsUntilLongBreak <= 10
            ) {
                sessionsUntilLongBreak.value = data.sessionsUntilLongBreak
            }

            // 验证并加载自动开始下一轮专注
            if (typeof data.autoStartNextFocusSession === 'boolean') {
                autoStartNextFocusSession.value = data.autoStartNextFocusSession
            }

            // 验证并加载自动开始专注次数
            if (
                typeof data.autoStartNextFocusSessionCount === 'number' &&
                data.autoStartNextFocusSessionCount >= 1 &&
                data.autoStartNextFocusSessionCount <= 10
            ) {
                autoStartNextFocusSessionCount.value = data.autoStartNextFocusSessionCount
            }

            // 验证并加载自动休息
            if (typeof data.autoRest === 'boolean') {
                autoRest.value = data.autoRest
            }
        } catch (error) {
            console.error('Failed to load pomodoro settings from localStorage:', error)
        }
    }

    /**
     * 保存番茄钟设置到 localStorage
     */
    const saveSettings = () => {
        try {
            const data = {
                focusDuration: focusDuration.value,
                breakDuration: breakDuration.value,
                longBreakDuration: longBreakDuration.value,
                sessionsUntilLongBreak: sessionsUntilLongBreak.value,
                autoStartNextFocusSession: autoStartNextFocusSession.value,
                autoStartNextFocusSessionCount: autoStartNextFocusSessionCount.value,
                autoRest: autoRest.value
            }
            localStorage.setItem(POMODORO_SETTINGS_KEY, JSON.stringify(data))
        } catch (error) {
            console.error('Failed to save pomodoro settings to localStorage:', error)
        }
    }

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

    /**
     * 清除当前会话（仅清除记录 ID 和开始时间）
     * @description 不清除 currentTaskId/currentTaskName —— 任务应保持关联以支持连续专注；
     *              noteText 在 addRecord 创建记录时同步清除。
     */
    const clearCurrentSession = () => {
        currentRecordId.value = null
        currentRecordStartAt.value = null
    }

    // @action 添加专注记录（异步：先调 API 持久化，成功后再推入本地列表）
    const addRecord = async (
        createViewObject: CreatePomodoroRecordViewObject
    ): GoAsync<PomodoroRecordViewObject[]> => {
        const [record, err] = await pomodoroRecordUseCase.createRecord(createViewObject)
        if (err !== null) return [null, err]
        onRecordCreated?.(record)
        noteText.value = ''
        return [[record], null]
    }

    // @action 更新记录笔记
    const updateNote = (recordId: string, note: string) => {
        const record = records.value.find((r) => r.sessionId === recordId)
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
        saveSettings()
    }

    // @action 设置短休息时长
    const setBreakDuration = (seconds: number) => {
        breakDuration.value = seconds
        saveSettings()
    }

    // @action 设置长休息时长
    const setLongBreakDuration = (seconds: number) => {
        longBreakDuration.value = seconds
        saveSettings()
    }

    // @action 设置触发长休息所需的专注次数
    const setSessionsUntilLongBreak = (n: number) => {
        sessionsUntilLongBreak.value = n
        saveSettings()
    }

    // @action 设置自动开始下一轮专注
    const setAutoStartNextFocusSession = (value: boolean) => {
        autoStartNextFocusSession.value = value
        saveSettings()
    }

    // @action 设置自动开始专注次数
    const setAutoStartNextFocusSessionCount = (n: number) => {
        autoStartNextFocusSessionCount.value = n
        saveSettings()
    }

    // @action 设置自动休息
    const setAutoRest = (value: boolean) => {
        autoRest.value = value
        saveSettings()
    }

    // 初始化时加载已保存的设置
    loadSavedSettings()

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
        setAutoRest,
        getRecord,
        setRecords,
        addRecords,
        setOnRecordCreated
    }
})

export default usePomodoroStore

