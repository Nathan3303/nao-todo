import { usePomodoroRecordUseCase } from '@/hooks'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'
import type { PomodoroViewObject } from '@nao-todo/domain-pomodoro'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { POMODORO_MAX_FOCUS_SECONDS, POMODORO_MIN_FOCUS_SECONDS } from '@nao-todo/domain-pomodoro'
import {
    usePomodoroFocusStore,
    usePomodoroRecordsStore,
    usePomodoroSessionStore,
    usePomodoroTimerStore
} from '@nao-todo/presentation/pomodoro'
import { POMODORO_TIMER_SETTING_DIALOG_KEY } from '@nao-todo/shared/constants'
import { type DialogManager } from '@nao-todo/shared/hooks'
import { NueConfirm, NueMessage } from 'nue-ui'
import { computed, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// 番茄钟 Tab 类型
export type PomodoroTab = 'timer' | 'focus'

/**
 * 番茄钟页面 composable
 * @description 合并番茄专注（倒计时）和正计时（累计计时）两种模式，
 *              通过路由参数 :type(timer|focus) 切换 Tab，共享记录加载与笔记。
 */
export const usePomodoroPage = (dialogManager: DialogManager) => {
    const route = useRoute()
    const router = useRouter()
    const { showTaskDetails } = inject(POMODORO_VIEW_CONTEXT_KEY)!

    const recordsStore = usePomodoroRecordsStore()
    const sessionStore = usePomodoroSessionStore()
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
        set: async (tab: PomodoroTab) => {
            const base = `/pomodoro/${tab}`
            const taskId = route.params.taskId as string
            await router.push(taskId ? `${base}/${taskId}` : base)
        }
    })

    // ========================================================================
    // Record UseCase（创建设置；今日列表 loader 已上移至 entry 级，T451）
    // ========================================================================

    const pomodoroRecordUseCase = usePomodoroRecordUseCase(recordsStore)

    timerStore.setCreateRecordFn(async (record) => {
        const [result, err] = await pomodoroRecordUseCase.createRecord(record)
        if (err !== null) return [null, err]
        sessionStore.setNoteText('')
        return [[result], null]
    })

    focusStore.setCreateRecordFn(async (record) => {
        const [result, err] = await pomodoroRecordUseCase.createRecord(record)
        if (err !== null) return [null, err]
        sessionStore.setNoteText('')
        return [[result], null]
    })

    // ========================================================================
    // Shared
    // ========================================================================

    const taskName = computed(() => sessionStore.currentTaskName)
    const taskId = computed(() => sessionStore.currentTaskId)

    const handleSelectTask = (task: TaskViewObject) => {
        sessionStore.selectTask(task.id, task.name)
    }

    const handleClearTask = () => {
        sessionStore.selectTask(null, '')
    }

    const presetId = computed(() => sessionStore.currentPomodoroId)
    const presetName = computed(() => sessionStore.currentPomodoroName)

    const handleSelectPreset = (preset: PomodoroViewObject | null) => {
        if (preset === null) {
            sessionStore.clearPomodoroSelection()
            return
        }
        sessionStore.selectPomodoro(preset.id, preset.name)
        if (activeTab.value === 'timer' && timerStore.phase === 'idle') {
            sessionStore.setFocusDuration(preset.duration)
            timerStore.updateConfig()
        }
    }

    // ========================================================================
    // Timer Handlers
    // ========================================================================

    const handleStart = async () => {
        const seconds = timerStore.totalSeconds
        if (seconds < POMODORO_MIN_FOCUS_SECONDS) {
            NueMessage.warn('专注时间不能小于 5 分钟')
            return
        }
        if (seconds > POMODORO_MAX_FOCUS_SECONDS) {
            NueMessage.warn('专注时间不能大于 180 分钟')
            return
        }

        const doStart = async () => {
            if ('Notification' in window && Notification.permission === 'default') {
                await Notification.requestPermission()
            }
            // 互斥安全网
            const focusS = usePomodoroFocusStore()
            if (focusS.status !== 'idle') focusS.reset()
            timerStore.start()
        }

        // 互斥提醒
        const focusS = usePomodoroFocusStore()
        if (focusS.status !== 'idle') {
            return NueConfirm({
                title: '正计时正在运行',
                content: '当前有正在运行的正计时，开始番茄专注将结束正计时。是否继续？',
                confirmButtonText: '继续',
                cancelButtonText: '取消',
                onConfirm: doStart
            })
        }

        return await doStart()
    }

    const handleAdjustTime = (delta: number) => {
        timerStore.adjustTime(delta)
    }

    // @method 「结束专注」：落库已专注时长后回 idle（T456 ①：原 `reset` 不落库 ⇒ 侧栏/记录页无此记录）
    const handleReset = () => {
        timerStore.end()
    }

    const handleOpenSettings = () => {
        dialogManager.open(POMODORO_TIMER_SETTING_DIALOG_KEY, null, () => {
            timerStore.updateConfig()
        })
    }

    // ========================================================================
    // Focus Handlers
    // ========================================================================

    const handleFocusStart = async () => {
        const doStart = async () => {
            if ('Notification' in window && Notification.permission === 'default') {
                await Notification.requestPermission()
            }
            // 互斥安全网
            const timerS = usePomodoroTimerStore()
            if (timerS.phase !== 'idle') timerS.reset()
            focusStore.start()
        }

        // 互斥提醒
        const timerS = usePomodoroTimerStore()
        if (timerS.phase !== 'idle') {
            return NueConfirm({
                title: '番茄钟正在运行',
                content: '当前有正在进行的番茄专注，开始正计时将结束当前番茄钟。是否继续？',
                confirmButtonText: '继续',
                cancelButtonText: '取消',
                onConfirm: doStart
            })
        }

        return await doStart()
    }

    const handleMainAction = async () => {
        if (focusStore.status === 'idle') {
            await handleFocusStart()
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
        noteText: computed(() => sessionStore.noteText),
        setNoteText: (text: string) => sessionStore.setNoteText(text),
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