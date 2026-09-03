import { defineStore } from 'pinia'
import { ref } from 'vue'

const POMODORO_SETTINGS_KEY = 'POMODORO_SETTINGS'

export const usePomodoroSessionStore = defineStore('PomodoroSessionStore', () => {
    const currentTaskId = ref<string | null>(null)
    const currentTaskName = ref('')
    const currentPomodoroId = ref<string | null>(null)
    const currentPomodoroName = ref('')
    const currentRecordId = ref<string | null>(null)
    const currentRecordStartAt = ref<string | null>(null)
    const noteText = ref('')

    const focusDuration = ref(25 * 60)
    const breakDuration = ref(5 * 60)
    const longBreakDuration = ref(15 * 60)
    const sessionsUntilLongBreak = ref(4)
    const autoStartNextFocusSession = ref(false)
    const autoStartNextFocusSessionCount = ref(4)
    const autoRest = ref(true)

    const loadSavedSettings = () => {
        try {
            const saved = localStorage.getItem(POMODORO_SETTINGS_KEY)
            if (!saved) return

            const data = JSON.parse(saved)

            if (
                typeof data.focusDuration === 'number' &&
                data.focusDuration >= 300 &&
                data.focusDuration <= 10800
            ) {
                focusDuration.value = data.focusDuration
            }

            if (
                typeof data.breakDuration === 'number' &&
                data.breakDuration >= 60 &&
                data.breakDuration <= 3600
            ) {
                breakDuration.value = data.breakDuration
            }

            if (
                typeof data.longBreakDuration === 'number' &&
                data.longBreakDuration >= 60 &&
                data.longBreakDuration <= 3600
            ) {
                longBreakDuration.value = data.longBreakDuration
            }

            if (
                typeof data.sessionsUntilLongBreak === 'number' &&
                data.sessionsUntilLongBreak >= 1 &&
                data.sessionsUntilLongBreak <= 10
            ) {
                sessionsUntilLongBreak.value = data.sessionsUntilLongBreak
            }

            if (typeof data.autoStartNextFocusSession === 'boolean') {
                autoStartNextFocusSession.value = data.autoStartNextFocusSession
            }

            if (
                typeof data.autoStartNextFocusSessionCount === 'number' &&
                data.autoStartNextFocusSessionCount >= 1 &&
                data.autoStartNextFocusSessionCount <= 10
            ) {
                autoStartNextFocusSessionCount.value = data.autoStartNextFocusSessionCount
            }

            if (typeof data.autoRest === 'boolean') {
                autoRest.value = data.autoRest
            }
        } catch (error) {
            console.error('Failed to load pomodoro settings from localStorage:', error)
        }
    }

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

    const selectTask = (taskId: string | null, taskName: string) => {
        currentTaskId.value = taskId
        currentTaskName.value = taskName
    }

    const selectPomodoro = (id: string | null, name: string) => {
        currentPomodoroId.value = id
        currentPomodoroName.value = name
    }

    const clearPomodoroSelection = () => {
        currentPomodoroId.value = null
        currentPomodoroName.value = ''
    }

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

    const clearCurrentSession = () => {
        currentRecordId.value = null
        currentRecordStartAt.value = null
    }

    const setNoteText = (text: string) => {
        noteText.value = text
    }

    const setFocusDuration = (seconds: number) => {
        focusDuration.value = seconds
        saveSettings()
    }

    const setBreakDuration = (seconds: number) => {
        breakDuration.value = seconds
        saveSettings()
    }

    const setLongBreakDuration = (seconds: number) => {
        longBreakDuration.value = seconds
        saveSettings()
    }

    const setSessionsUntilLongBreak = (n: number) => {
        sessionsUntilLongBreak.value = n
        saveSettings()
    }

    const setAutoStartNextFocusSession = (value: boolean) => {
        autoStartNextFocusSession.value = value
        saveSettings()
    }

    const setAutoStartNextFocusSessionCount = (n: number) => {
        autoStartNextFocusSessionCount.value = n
        saveSettings()
    }

    const setAutoRest = (value: boolean) => {
        autoRest.value = value
        saveSettings()
    }

    loadSavedSettings()

    return {
        currentTaskId,
        currentTaskName,
        currentPomodoroId,
        currentPomodoroName,
        currentRecordId,
        currentRecordStartAt,
        noteText,
        focusDuration,
        breakDuration,
        longBreakDuration,
        sessionsUntilLongBreak,
        autoStartNextFocusSession,
        autoStartNextFocusSessionCount,
        autoRest,
        selectTask,
        selectPomodoro,
        clearPomodoroSelection,
        setCurrentSession,
        clearCurrentSession,
        setNoteText,
        setFocusDuration,
        setBreakDuration,
        setLongBreakDuration,
        setSessionsUntilLongBreak,
        setAutoStartNextFocusSession,
        setAutoStartNextFocusSessionCount,
        setAutoRest
    }
})