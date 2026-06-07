import { computed } from 'vue'
import { nanoid } from 'nanoid'
import dayjs from 'dayjs'
import { NueMessage } from 'nue-ui'
import type { PomodoroRecordViewObject } from '@/components/pomodoro/timer/types'
import { useTimer } from '@/components/pomodoro/timer/use-timer'
import usePomodoroStore from '@/stores/pomodoro-store'
import { POMODORO_TIMER_SETTING_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'
import type DialogManager from '@/infrastructure/hooks/use-dialog-manager'
import type { TaskViewObject } from '@nao-todo/types'
import { MIN_FOCUS_SECONDS, MAX_FOCUS_SECONDS } from './constants'
import { formatMinutes, notify } from './utils'

/**
 * 创建一条专注记录
 */
const buildRecord = (store: ReturnType<typeof usePomodoroStore>, total: number): PomodoroRecordViewObject => ({
    id: store.currentRecordId!,
    taskId: store.currentTaskId ?? '',
    name: store.currentTaskName || '未关联任务',
    type: 'timer',
    startAt: store.currentRecordStartAt!,
    endAt: new Date().toISOString(),
    duration: total,
    note: store.noteText
})

/**
 * 番茄钟计时器页面 composable
 * @description 封装计时器的 store 访问、会话管理、事件回调与所有交互处理逻辑
 */
export const useTimerPage = (dialogManager: DialogManager) => {
    /**
     * store 访问
     * @store PomodoroStore 专注记录管理（当前选中任务、会话、记录的统一数据源）
     */
    const pomodoroStore = usePomodoroStore()

    // @computed 当前选中任务名称（由 selectTask 事件 → store.selectTask 驱动）
    const taskName = computed(() => pomodoroStore.currentTaskName)

    /**
     * 处理任务选择
     * @description 由 PomodoroTaskSelectDropdown 的 selectTask 事件触发，写入 store
     */
    const handleSelectTask = (task: TaskViewObject) => {
        pomodoroStore.selectTask(task.id, task.name)
    }

    /**
     * 开始新的专注会话
     * @description 从 store 读取当前选中任务，仅在没有当前会话时生成新的专注记录 ID 和开始时间
     */
    const startNewFocusSession = () => {
        if (!pomodoroStore.currentRecordId) {
            const recordId = nanoid()
            const startAt = new Date().toISOString()
            pomodoroStore.setCurrentSession(
                pomodoroStore.currentTaskId,
                pomodoroStore.currentTaskName,
                recordId,
                startAt
            )
            pomodoroStore.setNoteText('')
        }
    }

    // @composable 纯倒计时逻辑（委托给 usePomodoroStateMachine）
    const timer = useTimer({
        focusDuration: pomodoroStore.focusDuration,
        breakDuration: pomodoroStore.breakDuration,
        longBreakDuration: pomodoroStore.longBreakDuration,
        sessionsUntilLongBreak: pomodoroStore.sessionsUntilLongBreak,
        autoRest: pomodoroStore.autoRest,
        autoStartNextFocusSession: pomodoroStore.autoStartNextFocusSession,
        autoStartNextFocusSessionCount: pomodoroStore.autoStartNextFocusSessionCount,
        onPhaseComplete(phase, _elapsed, total) {
            if (phase === 'focus') {
                const record = buildRecord(pomodoroStore, total)
                console.log('[Pomodoro] 创建专注记录', record)
                pomodoroStore.addRecord(record)
                notify('专注完成', `已完成 ${formatMinutes(total)} 的专注，现在开始休息`)
            }
            if (phase === 'break' || phase === 'longBreak') {
                startNewFocusSession()
                notify('休息结束', '现在开始下一轮的专注计时')
            }
        },
        onBreakWarning(remaining: number) {
            const mins = Math.floor(remaining / 60)
            const secs = remaining % 60
            const timeStr = mins > 0 ? `${mins} 分钟${secs > 0 ? ` ${secs} 秒` : ''}` : `${secs} 秒`
            notify('休息即将结束', `剩余 ${timeStr} 的休息时间，准备好进行下一轮专注了吗？`)
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onSkip(phase, elapsed, _total) {
            if (phase === 'focus') {
                // 使用 elapsed（实际已用时间）而不是 _total（计划时间）
                const record = buildRecord(pomodoroStore, elapsed)
                console.log('[Pomodoro] 跳过专注，创建部分记录', record)
                pomodoroStore.addRecord(record)
                startNewFocusSession()
            }
            if (phase === 'break' || phase === 'longBreak') {
                startNewFocusSession()
            }
        }
    })

    // @handlers
    const handleStart = () => {
        const seconds = timer.totalSeconds.value
        if (seconds < MIN_FOCUS_SECONDS) {
            NueMessage.warn('专注时间不能小于 5 分钟')
            return
        }
        if (seconds > MAX_FOCUS_SECONDS) {
            NueMessage.warn('专注时间不能大于 180 分钟')
            return
        }
        // 预请求系统通知权限
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission()
        }
        startNewFocusSession()
        timer.start()
    }

    /**
     * 调整专注时间
     * @param delta 调整时间（秒）
     */
    const handleAdjustTime = (delta: number) => {
        timer.adjustTime(delta)
        // 空闲状态下的调整需要同步回 store，作为后续专注会话的默认时长
        if (timer.phase.value === 'idle') {
            pomodoroStore.setFocusDuration(timer.totalSeconds.value)
        }
    }

    /**
     * 重置专注时间
     */
    const handleReset = () => {
        timer.reset()
        pomodoroStore.clearCurrentSession()
    }

    /**
     * 打开专注钟设置弹窗
     */
    const handleOpenSettings = () => {
        dialogManager.open(POMODORO_TIMER_SETTING_DIALOG_KEY, null, () => {
            timer.updateConfig({
                focusDuration: pomodoroStore.focusDuration,
                breakDuration: pomodoroStore.breakDuration,
                longBreakDuration: pomodoroStore.longBreakDuration,
                sessionsUntilLongBreak: pomodoroStore.sessionsUntilLongBreak,
                autoRest: pomodoroStore.autoRest,
                autoStartNextFocusSession: pomodoroStore.autoStartNextFocusSession,
                autoStartNextFocusSessionCount: pomodoroStore.autoStartNextFocusSessionCount
            })
        })
    }

    /**
     * 保存专注记录笔记
     */
    const handleSaveNote = () => {
        if (pomodoroStore.currentRecordId) {
            pomodoroStore.updateNote(pomodoroStore.currentRecordId, pomodoroStore.noteText)
            console.log('[Pomodoro] 保存笔记', {
                recordId: pomodoroStore.currentRecordId,
                note: pomodoroStore.noteText
            })
        }
    }

    // @computed 今日专注记录
    const todayRecords = computed(() =>
        pomodoroStore.records.filter((r) => dayjs(r.startAt).isSame(dayjs(), 'day'))
    )

    // @returns
    return {
        timer,
        taskName,
        handleSelectTask,
        todayRecords,
        /** 当前笔记文本（绑定到 pomodoro-notes-comp） */
        noteText: computed(() => pomodoroStore.noteText),
        /** 更新笔记文本 */
        setNoteText: (text: string) => pomodoroStore.setNoteText(text),
        handleStart,
        handleAdjustTime,
        handleReset,
        handleOpenSettings,
        handleSaveNote
    }
}
