import type { TimerPhase } from './types'
import { usePomodoroStateMachine } from './use-pomodoro-state-machine'
import type { StateMachineCallbacks } from './use-pomodoro-state-machine'

/**
 * useTimer 配置选项
 */
export interface UseTimerOptions {
    /** 初始专注时长（秒） */
    focusDuration: number
    /** 初始休息时长（秒） */
    breakDuration: number
    /** 阶段完成回调 */
    onPhaseComplete?: (phase: TimerPhase, elapsedSeconds: number, totalSeconds: number) => void
    /** 跳过回调 */
    onSkip?: (phase: TimerPhase, elapsedSeconds: number, totalSeconds: number) => void
    /** 休息阶段剩余时间提醒回调（参数为触发时的剩余秒数） */
    onBreakWarning?: (remainingSeconds: number) => void
    /** 长休息时长（秒） */
    longBreakDuration: number
    /** 触发长休息所需的专注次数 */
    sessionsUntilLongBreak: number
    /** 专注完成后自动进入休息（默认 true） */
    autoRest?: boolean
    /** 休息结束后自动开始下一轮专注（默认 false） */
    autoStartNextFocusSession?: boolean
    /** 自动开始专注次数上限（默认 4） */
    autoStartNextFocusSessionCount?: number
}

/**
 * 纯倒计时 composable（薄包装）
 * @description 内部委托给 usePomodoroStateMachine 显式状态机，保持向后兼容的 API。
 *              setInterval 仅用于 UI 刷新 tick，实际剩余时间通过目标结束时间与当前时间的差值反算。
 */
export const useTimer = (options: UseTimerOptions) => {
    // 将旧的粗粒度回调映射为状态机的细粒度回调
    const callbacks: StateMachineCallbacks = {
        onFocusComplete: (elapsed, total) => {
            options.onPhaseComplete?.('focus', elapsed, total)
        },
        onFocusSkip: (elapsed, total) => {
            options.onSkip?.('focus', elapsed, total)
        },
        onBreakComplete: (phase, elapsed, total) => {
            options.onPhaseComplete?.(phase, elapsed, total)
        },
        onBreakSkip: (phase, elapsed, total) => {
            options.onSkip?.(phase, elapsed, total)
        },
        onBreakWarning: (remaining) => {
            options.onBreakWarning?.(remaining)
        },
        onReset: () => {
            // 旧 API 无 onReset 回调，由 useTimerPage 在外部处理
        },
        onAutoRestDisabled: () => {
            // 旧 API 无此回调 → 专注完成后通知由 useTimerPage 处理
        },
        onAutoStartLimitReached: () => {
            // 旧 API 无此回调
        }
    }

    const machine = usePomodoroStateMachine({
        config: {
            focusDuration: options.focusDuration,
            breakDuration: options.breakDuration,
            longBreakDuration: options.longBreakDuration,
            sessionsUntilLongBreak: options.sessionsUntilLongBreak,
            autoRest: options.autoRest ?? true,
            autoStartNextFocusSession: options.autoStartNextFocusSession ?? false,
            autoStartNextFocusSessionCount: options.autoStartNextFocusSessionCount ?? 4
        },
        callbacks
    })

    return machine
}
