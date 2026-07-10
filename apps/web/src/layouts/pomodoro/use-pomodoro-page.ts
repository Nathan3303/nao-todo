import { computed, inject, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { NueMessage, NueConfirm } from 'nue-ui'
import usePomodoroStore from '@/stores/pomodoro-store'
import { usePomodoroTimerStore } from '@/stores/pomodoro-timer-store'
import { usePomodoroFocusStore } from '@/stores/pomodoro-focus-store'
import { POMODORO_TIMER_SETTING_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'
import type DialogManager from '@/infrastructure/hooks/use-dialog-manager'
import type { TaskViewObject } from '@nao-todo/usecases/task'
import type { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import { newPomodoroRecordUseCase } from '@nao-todo/usecases/pomodoro'
import type { PomodoroViewObject } from '@nao-todo/usecases/pomodoro'
import usePomodoroRecordLoader from '@/infrastructure/hooks/use-pomodoro-record-loader'
import {
    POMODORO_MIN_FOCUS_SECONDS,
    POMODORO_MAX_FOCUS_SECONDS
} from '@/infrastructure/constants/pomodoro'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'

export type PomodoroTab = 'timer' | 'focus'

/**
 * 番茄钟页面 composable
 * @description 合并番茄专注（倒计时）和正计时（累计计时）两种模式，
 *              通过路由参数 :type(timer|focus) 切换 Tab，共享记录加载与笔记。
 */
export const usePomodoroPage = (dialogManager: DialogManager, subscriber?: Subscriber) => {
    const route = useRoute()
    const router = useRouter()
    const { showTaskDetails } = inject(POMODORO_VIEW_CONTEXT_KEY)!

    const pomodoroStore = usePomodoroStore()
    const timerStore = usePomodoroTimerStore()
    const focusStore = usePomodoroFocusStore()

    // ========================================================================
    // Tab State（由路由驱动）
    // ========================================================================

    const activeTab = computed<PomodoroTab>(() => {
        const type = route.params.type
        if (type === 'focus') return 'focus'
        return 'timer'
    })

    const activeTabLocal = computed({
        get: () => activeTab.value,
        set: (tab: PomodoroTab) => {
            const base = `/pomodoro/${tab}`
            const taskId = route.params.taskId
            router.push(taskId ? `${base}/${taskId}` : base)
        }
    })

    // ========================================================================
    // Record Loader（不过滤 type → 同时展示番茄钟和正计时记录）
    // ========================================================================

    const pomodoroRecordUseCase = newPomodoroRecordUseCase({
        addRecord: (record) => {
            pomodoroStore.addRecord(record)
        },
        addRecords: (records) => {
            pomodoroStore.addRecords(records)
        }
    })

    const recordLoader = usePomodoroRecordLoader(
        pomodoroRecordUseCase,
        {
            startTime: dayjs().startOf('day').toISOString(),
            endTime: dayjs().endOf('day').toISOString(),
            sort: 'startAt:desc'
        },
        subscriber
    )

    // ========================================================================
    // Shared
    // ========================================================================

    const taskName = computed(() => pomodoroStore.currentTaskName)
    const taskId = computed(() => pomodoroStore.currentTaskId)

    const handleSelectTask = (task: TaskViewObject) => {
        pomodoroStore.selectTask(task.id, task.name)
    }

    const handleClearTask = () => {
        pomodoroStore.selectTask(null, '')
    }

    const presetId = computed(() => pomodoroStore.currentPomodoroId)
    const presetName = computed(() => pomodoroStore.currentPomodoroName)

    const handleSelectPreset = (preset: PomodoroViewObject | null) => {
        if (preset === null) {
            pomodoroStore.clearPomodoroSelection()
            return
        }
        pomodoroStore.selectPomodoro(preset.id, preset.name)
        // 套用预设时长（仅番茄专注 timer 模式且空闲时）
        if (activeTab.value === 'timer' && timerStore.phase === 'idle') {
            pomodoroStore.setFocusDuration(preset.duration)
            timerStore.updateConfig()
        }
    }

    const handleNextPage = () => {
        recordLoader.loadNextPage()
    }

    onMounted(() => {
        recordLoader.loadFirstPage()
    })

    // ========================================================================
    // Timer Handlers
    // ========================================================================

    const handleStart = () => {
        const seconds = timerStore.totalSeconds
        if (seconds < POMODORO_MIN_FOCUS_SECONDS) {
            NueMessage.warn('专注时间不能小于 5 分钟')
            return
        }
        if (seconds > POMODORO_MAX_FOCUS_SECONDS) {
            NueMessage.warn('专注时间不能大于 180 分钟')
            return
        }

        const doStart = () => {
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission()
            }
            // 互斥安全网
            const focusS = usePomodoroFocusStore()
            if (focusS.status !== 'idle') focusS.reset()
            timerStore.start()
        }

        // 互斥提醒
        const focusS = usePomodoroFocusStore()
        if (focusS.status !== 'idle') {
            NueConfirm({
                title: '正计时正在运行',
                content: '当前有正在运行的正计时，开始番茄专注将结束正计时。是否继续？',
                confirmButtonText: '继续',
                cancelButtonText: '取消',
                onConfirm: doStart
            })
            return
        }

        if (!pomodoroStore.currentTaskId) {
            NueConfirm({
                title: '确认开始专注',
                content: '还没有选择待办任务，是否要继续开始专注？',
                confirmButtonText: '继续',
                cancelButtonText: '取消',
                onConfirm: doStart
            })
        } else {
            doStart()
        }
    }

    const handleAdjustTime = (delta: number) => {
        timerStore.adjustTime(delta)
    }

    const handleReset = () => {
        timerStore.reset()
    }

    const handleOpenSettings = () => {
        dialogManager.open(POMODORO_TIMER_SETTING_DIALOG_KEY, null, () => {
            timerStore.updateConfig()
        })
    }

    // ========================================================================
    // Focus Handlers
    // ========================================================================

    const handleFocusStart = () => {
        const doStart = () => {
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission()
            }
            // 互斥安全网
            const timerS = usePomodoroTimerStore()
            if (timerS.phase !== 'idle') timerS.reset()
            focusStore.start()
        }

        // 互斥提醒
        const timerS = usePomodoroTimerStore()
        if (timerS.phase !== 'idle') {
            NueConfirm({
                title: '番茄钟正在运行',
                content: '当前有正在进行的番茄专注，开始正计时将结束当前番茄钟。是否继续？',
                confirmButtonText: '继续',
                cancelButtonText: '取消',
                onConfirm: doStart
            })
            return
        }

        if (!pomodoroStore.currentTaskId) {
            NueConfirm({
                title: '确认开始正计时',
                content: '还没有选择待办任务，是否要继续开始？',
                confirmButtonText: '继续',
                cancelButtonText: '取消',
                onConfirm: doStart
            })
        } else {
            doStart()
        }
    }

    const handleMainAction = () => {
        if (focusStore.status === 'idle') {
            handleFocusStart()
        } else if (focusStore.status === 'running') {
            focusStore.pause()
        } else {
            focusStore.resume()
        }
    }

    const handleCancel = () => {
        focusStore.reset()
    }

    const handleEnd = () => {
        focusStore.end()
    }

    // ========================================================================
    // Return
    // ========================================================================

    return {
        // Tab
        activeTab,
        activeTabLocal,
        // Store refs（模板中需要直接访问 pause / resume / skip / phase 等）
        timerStore,
        focusStore,
        // Shared
        taskId,
        taskName,
        handleSelectTask,
        handleClearTask,
        presetId,
        presetName,
        handleSelectPreset,
        todayRecords: recordLoader.records,
        noteText: computed(() => pomodoroStore.noteText),
        setNoteText: (text: string) => pomodoroStore.setNoteText(text),
        recordLoading: computed(() => recordLoader.states.loading),
        recordIsDone: computed(() => recordLoader.states.isDone),
        handleNextPage,
        showTaskDetails,
        // Timer
        handleStart,
        handleAdjustTime,
        handleReset,
        handleOpenSettings,
        // Focus
        handleMainAction,
        handleCancel,
        handleEnd
    }
}

