import { ref, computed, onBeforeUnmount, type Ref } from 'vue'
import type { TimerPhase, TimerStatus } from './types'

// ============================================================
// Types
// ============================================================

/** 状态机组合状态 */
interface MachineState {
    phase: TimerPhase
    status: TimerStatus
}

/** 状态机事件 */
type MachineEvent =
    | { type: 'START' }
    | { type: 'PAUSE' }
    | { type: 'RESUME' }
    | { type: 'RESET' }
    | { type: 'SKIP' }
    | { type: 'PHASE_COMPLETE' }
    | { type: 'ADJUST_TIME'; delta: number }

/** 转换条目 */
interface TransitionEntry {
    target: MachineState
    guard?: (ctx: MachineContext, event?: MachineEvent) => boolean
    action?: (ctx: MachineContext, event?: MachineEvent) => void
}

/** 状态机运行时上下文 */
interface MachineContext {
    // 公开状态
    phase: Ref<TimerPhase>
    status: Ref<TimerStatus>
    remainingSeconds: Ref<number>
    totalSeconds: Ref<number>
    // 内部配置
    config: {
        focusDuration: number
        breakDuration: number
        longBreakDuration: number
        sessionsUntilLongBreak: number
        autoStartNextFocusSession: boolean
        autoStartNextFocusSessionCount: number
        autoRest: boolean
    }
    // 运行时计数器（对象包装以实现引用传递）
    counters: {
        completedRoundCount: number
        autoStartCount: number
    }
    // 倒计时引擎
    targetEndTime: number
    pausedRemainingMs: number
    breakWarningSent: boolean
    intervalId: ReturnType<typeof setInterval> | null
    lastTickNow: number
    // 回调
    callbacks: StateMachineCallbacks
    // 内部方法
    startInterval: () => void
    stopInterval: () => void
    tick: () => void
    calcRemaining: () => number
    calcElapsed: () => number
    isLongBreakDue: () => boolean
    resetToIdle: () => void
    enterBreakPhase: () => void
    enterFocusPhase: () => void
    transitionToNextFocusOrIdle: () => void
}

// ============================================================
// State key helpers
// ============================================================

const stateKey = (phase: TimerPhase, status: TimerStatus): string =>
    `${phase}:${status}`

const mkState = (phase: TimerPhase, status: TimerStatus): MachineState =>
    ({ phase, status })

// ============================================================
// Constants
// ============================================================

const MIN_FOCUS_SECONDS = 5 * 60
const MAX_FOCUS_SECONDS = 180 * 60
const TICK_INTERVAL_MS = 250

// ============================================================
// Transition Table
// ============================================================

type TransitionTable = Record<string, Record<string, TransitionEntry>>

const buildTransitionTable = (): TransitionTable => {
    const T: TransitionTable = {}

    // --- IDLE ---
    const idle = stateKey('idle', 'paused')

    T[idle] = {
        START: {
            target: mkState('focus', 'running'),
            guard: (ctx) => {
                const secs = ctx.totalSeconds.value
                return secs >= MIN_FOCUS_SECONDS && secs <= MAX_FOCUS_SECONDS
            },
            action: (ctx) => {
                const fd = ctx.config.focusDuration
                ctx.phase.value = 'focus'
                ctx.status.value = 'running'
                ctx.totalSeconds.value = fd
                ctx.remainingSeconds.value = fd
                ctx.targetEndTime = Date.now() + fd * 1000
                ctx.startInterval()
            }
        },
        ADJUST_TIME: {
            target: mkState('idle', 'paused'),
            guard: (ctx, event) => {
                const delta = (event as Extract<MachineEvent, { type: 'ADJUST_TIME' }>).delta
                const newRemaining = ctx.totalSeconds.value + delta
                return newRemaining >= MIN_FOCUS_SECONDS && newRemaining <= MAX_FOCUS_SECONDS
            },
            action: (ctx, event) => {
                const delta = (event as Extract<MachineEvent, { type: 'ADJUST_TIME' }>).delta
                const newRemaining = ctx.totalSeconds.value + delta
                ctx.config.focusDuration = newRemaining
                ctx.totalSeconds.value = newRemaining
                ctx.remainingSeconds.value = newRemaining
            }
        }
    }

    // --- FOCUS_RUNNING ---
    const focusRunning = stateKey('focus', 'running')

    T[focusRunning] = {
        PAUSE: {
            target: mkState('focus', 'paused'),
            action: (ctx) => {
                ctx.status.value = 'paused'
                ctx.pausedRemainingMs = ctx.targetEndTime - Date.now()
                ctx.remainingSeconds.value = Math.max(0, Math.ceil(ctx.pausedRemainingMs / 1000))
                ctx.stopInterval()
            }
        },
        SKIP: {
            target: mkState('focus', 'running'), // placeholder, resolved in action
            action: (ctx) => {
                const elapsed = ctx.calcElapsed()
                const total = ctx.totalSeconds.value
                ctx.callbacks.onFocusSkip(elapsed, total)
                ctx.stopInterval()
                ctx.enterBreakPhase()
            }
        },
        PHASE_COMPLETE: {
            target: mkState('focus', 'running'), // placeholder
            action: (ctx) => {
                const elapsed = ctx.totalSeconds.value
                const total = ctx.totalSeconds.value
                ctx.callbacks.onFocusComplete(elapsed, total)
                ctx.stopInterval()
                if (!ctx.config.autoRest) {
                    ctx.callbacks.onAutoRestDisabled()
                    ctx.resetToIdle()
                } else {
                    ctx.enterBreakPhase()
                }
            }
        },
        ADJUST_TIME: {
            target: mkState('focus', 'running'),
            guard: (ctx, event) => {
                const delta = (event as Extract<MachineEvent, { type: 'ADJUST_TIME' }>).delta
                return ctx.calcRemaining() + delta > 0
            },
            action: (ctx, event) => {
                const delta = (event as Extract<MachineEvent, { type: 'ADJUST_TIME' }>).delta
                const newRemaining = ctx.calcRemaining() + delta
                ctx.remainingSeconds.value = newRemaining
                ctx.totalSeconds.value += delta
                ctx.targetEndTime = Date.now() + newRemaining * 1000
            }
        }
    }

    // --- FOCUS_PAUSED ---
    const focusPaused = stateKey('focus', 'paused')

    T[focusPaused] = {
        RESUME: {
            target: mkState('focus', 'running'),
            action: (ctx) => {
                ctx.status.value = 'running'
                ctx.targetEndTime = Date.now() + ctx.pausedRemainingMs
                ctx.tick()
                ctx.startInterval()
            }
        },
        RESET: {
            target: mkState('idle', 'paused'),
            action: (ctx) => {
                ctx.stopInterval()
                ctx.callbacks.onReset()
                ctx.resetToIdle()
            }
        },
        SKIP: T[focusRunning].SKIP!, // same as running skip
        ADJUST_TIME: {
            target: mkState('focus', 'paused'),
            guard: (ctx, event) => {
                const delta = (event as Extract<MachineEvent, { type: 'ADJUST_TIME' }>).delta
                return ctx.calcRemaining() + delta > 0
            },
            action: (ctx, event) => {
                const delta = (event as Extract<MachineEvent, { type: 'ADJUST_TIME' }>).delta
                const newRemaining = ctx.calcRemaining() + delta
                ctx.remainingSeconds.value = newRemaining
                ctx.totalSeconds.value += delta
                ctx.pausedRemainingMs = newRemaining * 1000
            }
        }
    }

    // --- BREAK_RUNNING ---
    const breakRunning = stateKey('break', 'running')

    T[breakRunning] = {
        PAUSE: {
            target: mkState('break', 'paused'),
            action: (ctx) => {
                ctx.status.value = 'paused'
                ctx.pausedRemainingMs = ctx.targetEndTime - Date.now()
                ctx.remainingSeconds.value = Math.max(0, Math.ceil(ctx.pausedRemainingMs / 1000))
                ctx.stopInterval()
            }
        },
        SKIP: {
            target: mkState('break', 'running'), // placeholder
            action: (ctx) => {
                const elapsed = ctx.calcElapsed()
                const total = ctx.totalSeconds.value
                ctx.callbacks.onBreakSkip('break', elapsed, total)
                ctx.stopInterval()
                ctx.counters.completedRoundCount++
                ctx.transitionToNextFocusOrIdle()
            }
        },
        PHASE_COMPLETE: {
            target: mkState('break', 'running'), // placeholder
            action: (ctx) => {
                const elapsed = ctx.totalSeconds.value
                const total = ctx.totalSeconds.value
                ctx.callbacks.onBreakComplete('break', elapsed, total)
                ctx.stopInterval()
                ctx.counters.completedRoundCount++
                ctx.transitionToNextFocusOrIdle()
            }
        },
        ADJUST_TIME: {
            target: mkState('break', 'running'),
            guard: (ctx, event) => {
                const delta = (event as Extract<MachineEvent, { type: 'ADJUST_TIME' }>).delta
                return ctx.calcRemaining() + delta > 0
            },
            action: (ctx, event) => {
                const delta = (event as Extract<MachineEvent, { type: 'ADJUST_TIME' }>).delta
                const newRemaining = ctx.calcRemaining() + delta
                ctx.remainingSeconds.value = newRemaining
                ctx.totalSeconds.value += delta
                ctx.targetEndTime = Date.now() + newRemaining * 1000
            }
        }
    }

    // --- BREAK_PAUSED ---
    const breakPaused = stateKey('break', 'paused')

    T[breakPaused] = {
        RESUME: {
            target: mkState('break', 'running'),
            action: (ctx) => {
                ctx.status.value = 'running'
                ctx.targetEndTime = Date.now() + ctx.pausedRemainingMs
                ctx.tick()
                ctx.startInterval()
            }
        },
        RESET: {
            target: mkState('idle', 'paused'),
            action: (ctx) => {
                ctx.stopInterval()
                ctx.callbacks.onReset()
                ctx.resetToIdle()
            }
        },
        SKIP: T[breakRunning].SKIP!,
        ADJUST_TIME: {
            target: mkState('break', 'paused'),
            guard: (ctx, event) => {
                const delta = (event as Extract<MachineEvent, { type: 'ADJUST_TIME' }>).delta
                return ctx.calcRemaining() + delta > 0
            },
            action: (ctx, event) => {
                const delta = (event as Extract<MachineEvent, { type: 'ADJUST_TIME' }>).delta
                const newRemaining = ctx.calcRemaining() + delta
                ctx.remainingSeconds.value = newRemaining
                ctx.totalSeconds.value += delta
                ctx.pausedRemainingMs = newRemaining * 1000
            }
        }
    }

    // --- LONG_BREAK_RUNNING ---
    const longBreakRunning = stateKey('longBreak', 'running')

    T[longBreakRunning] = {
        PAUSE: {
            target: mkState('longBreak', 'paused'),
            action: (ctx) => {
                ctx.status.value = 'paused'
                ctx.pausedRemainingMs = ctx.targetEndTime - Date.now()
                ctx.remainingSeconds.value = Math.max(0, Math.ceil(ctx.pausedRemainingMs / 1000))
                ctx.stopInterval()
            }
        },
        SKIP: {
            target: mkState('longBreak', 'running'), // placeholder
            action: (ctx) => {
                const elapsed = ctx.calcElapsed()
                const total = ctx.totalSeconds.value
                ctx.callbacks.onBreakSkip('longBreak', elapsed, total)
                ctx.stopInterval()
                ctx.counters.completedRoundCount = 0
                ctx.transitionToNextFocusOrIdle()
            }
        },
        PHASE_COMPLETE: {
            target: mkState('longBreak', 'running'), // placeholder
            action: (ctx) => {
                const elapsed = ctx.totalSeconds.value
                const total = ctx.totalSeconds.value
                ctx.callbacks.onBreakComplete('longBreak', elapsed, total)
                ctx.stopInterval()
                ctx.counters.completedRoundCount = 0
                ctx.transitionToNextFocusOrIdle()
            }
        },
        ADJUST_TIME: {
            target: mkState('longBreak', 'running'),
            guard: (ctx, event) => {
                const delta = (event as Extract<MachineEvent, { type: 'ADJUST_TIME' }>).delta
                return ctx.calcRemaining() + delta > 0
            },
            action: (ctx, event) => {
                const delta = (event as Extract<MachineEvent, { type: 'ADJUST_TIME' }>).delta
                const newRemaining = ctx.calcRemaining() + delta
                ctx.remainingSeconds.value = newRemaining
                ctx.totalSeconds.value += delta
                ctx.targetEndTime = Date.now() + newRemaining * 1000
            }
        }
    }

    // --- LONG_BREAK_PAUSED ---
    const longBreakPaused = stateKey('longBreak', 'paused')

    T[longBreakPaused] = {
        RESUME: {
            target: mkState('longBreak', 'running'),
            action: (ctx) => {
                ctx.status.value = 'running'
                ctx.targetEndTime = Date.now() + ctx.pausedRemainingMs
                ctx.tick()
                ctx.startInterval()
            }
        },
        RESET: {
            target: mkState('idle', 'paused'),
            action: (ctx) => {
                ctx.stopInterval()
                ctx.callbacks.onReset()
                ctx.resetToIdle()
            }
        },
        SKIP: T[longBreakRunning].SKIP!,
        ADJUST_TIME: {
            target: mkState('longBreak', 'paused'),
            guard: (ctx, event) => {
                const delta = (event as Extract<MachineEvent, { type: 'ADJUST_TIME' }>).delta
                return ctx.calcRemaining() + delta > 0
            },
            action: (ctx, event) => {
                const delta = (event as Extract<MachineEvent, { type: 'ADJUST_TIME' }>).delta
                const newRemaining = ctx.calcRemaining() + delta
                ctx.remainingSeconds.value = newRemaining
                ctx.totalSeconds.value += delta
                ctx.pausedRemainingMs = newRemaining * 1000
            }
        }
    }

    return T
}

// ============================================================
// Callbacks interface
// ============================================================

export interface StateMachineCallbacks {
    onFocusComplete: (elapsed: number, total: number) => void
    onFocusSkip: (elapsed: number, total: number) => void
    onBreakComplete: (phase: 'break' | 'longBreak', elapsed: number, total: number) => void
    onBreakSkip: (phase: 'break' | 'longBreak', elapsed: number, total: number) => void
    onBreakWarning: (remaining: number) => void
    onReset: () => void
    onAutoRestDisabled: () => void
    onAutoStartLimitReached: () => void
}

export interface StateMachineConfig {
    focusDuration: number
    breakDuration: number
    longBreakDuration: number
    sessionsUntilLongBreak: number
    autoStartNextFocusSession: boolean
    autoStartNextFocusSessionCount: number
    autoRest: boolean
}

// ============================================================
// usePomodoroStateMachine
// ============================================================

export const usePomodoroStateMachine = (options: {
    config: StateMachineConfig
    callbacks: StateMachineCallbacks
}) => {
    const transitionTable = buildTransitionTable()

    // ---- Reactive state ----
    const phase = ref<TimerPhase>('idle')
    const status = ref<TimerStatus>('paused')
    const remainingSeconds = ref(options.config.focusDuration)
    const totalSeconds = ref(options.config.focusDuration)

    // ---- Internal engine state (使用对象包装以实现正确的引用传递) ----
    const engineState = {
        targetEndTime: 0,
        pausedRemainingMs: 0,
        intervalId: null as ReturnType<typeof setInterval> | null,
        lastTickNow: 0,
        breakWarningSent: false
    }
    // 使用对象包装计数器以实现正确的引用传递
    const counters = {
        completedRoundCount: 0,
        autoStartCount: 0
    }

    // ---- Context helpers (used by transition actions) ----
    const calcRemaining = (): number => {
        if (phase.value === 'idle') return remainingSeconds.value
        if (status.value === 'paused') return Math.max(0, Math.ceil(engineState.pausedRemainingMs / 1000))
        return Math.max(0, Math.ceil((engineState.targetEndTime - Date.now()) / 1000))
    }

    const calcElapsed = (): number => {
        return totalSeconds.value - calcRemaining()
    }

    const isLongBreakDue = (): boolean => {
        return counters.completedRoundCount >= options.config.sessionsUntilLongBreak
    }

    const startInterval = () => {
        stopInterval()
        engineState.lastTickNow = Date.now()
        engineState.intervalId = setInterval(tick, TICK_INTERVAL_MS)
    }

    const stopInterval = () => {
        if (engineState.intervalId !== null) {
            clearInterval(engineState.intervalId)
            engineState.intervalId = null
        }
    }

    const tick = () => {
        if (status.value !== 'running') return

        const now = Date.now()
        if (now < engineState.lastTickNow) {
            engineState.lastTickNow = now
        }
        engineState.lastTickNow = now

        remainingSeconds.value = Math.max(0, Math.ceil((engineState.targetEndTime - now) / 1000))

        // Break warning: 20% remaining or 3 minutes, whichever is smaller
        if (
            !engineState.breakWarningSent &&
            (phase.value === 'break' || phase.value === 'longBreak') &&
            totalSeconds.value > 0
        ) {
            const threshold = Math.min(Math.ceil(totalSeconds.value * 0.2), 180)
            if (remainingSeconds.value <= threshold) {
                engineState.breakWarningSent = true
                options.callbacks.onBreakWarning(remainingSeconds.value)
            }
        }

        if (remainingSeconds.value <= 0) {
            dispatch({ type: 'PHASE_COMPLETE' })
        }
    }

    const handleVisibilityChange = () => {
        if (document.hidden) return
        if (status.value !== 'running') return

        requestAnimationFrame(() => {
            if (status.value === 'running') {
                tick()
            }
        })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // ---- Transition helpers (used by actions) ----

    const resetToIdle = () => {
        phase.value = 'idle'
        status.value = 'paused'
        counters.completedRoundCount = 0
        counters.autoStartCount = 0
        const fd = options.config.focusDuration
        totalSeconds.value = fd
        remainingSeconds.value = fd
        engineState.targetEndTime = 0
        engineState.pausedRemainingMs = 0
    }

    const enterBreakPhase = () => {
        const long = isLongBreakDue()
        if (long) {
            counters.completedRoundCount = 0
        }
        const nextPhase: TimerPhase = long ? 'longBreak' : 'break'
        const nextDuration = long
            ? options.config.longBreakDuration
            : options.config.breakDuration
        phase.value = nextPhase
        engineState.breakWarningSent = false
        totalSeconds.value = nextDuration
        remainingSeconds.value = nextDuration
        engineState.targetEndTime = Date.now() + nextDuration * 1000
        status.value = 'running'
        startInterval()
    }

    const enterFocusPhase = () => {
        phase.value = 'focus'
        const fd = options.config.focusDuration
        totalSeconds.value = fd
        remainingSeconds.value = fd
        engineState.targetEndTime = Date.now() + fd * 1000
        status.value = 'running'
        startInterval()
    }

    const transitionToNextFocusOrIdle = () => {
        if (options.config.autoStartNextFocusSession) {
            if (counters.autoStartCount >= options.config.autoStartNextFocusSessionCount) {
                counters.autoStartCount = 0
                options.callbacks.onAutoStartLimitReached()
                resetToIdle()
                return
            }
            counters.autoStartCount++
            enterFocusPhase()
        } else {
            resetToIdle()
        }
    }

    // ---- Context object (passed to guard/action) ----
    // 注意：方法在 ctx 创建之后定义，但 TypeScript 允许在对象字面量中引用尚未定义的标识符
    const ctx: MachineContext = {
        phase,
        status,
        remainingSeconds,
        totalSeconds,
        config: options.config,
        counters,
        // 通过对象属性访问以实现引用传递
        get targetEndTime() { return engineState.targetEndTime },
        set targetEndTime(value) { engineState.targetEndTime = value },
        get pausedRemainingMs() { return engineState.pausedRemainingMs },
        set pausedRemainingMs(value) { engineState.pausedRemainingMs = value },
        get breakWarningSent() { return engineState.breakWarningSent },
        set breakWarningSent(value) { engineState.breakWarningSent = value },
        get intervalId() { return engineState.intervalId },
        set intervalId(value) { engineState.intervalId = value },
        get lastTickNow() { return engineState.lastTickNow },
        set lastTickNow(value) { engineState.lastTickNow = value },
        callbacks: options.callbacks,
        startInterval,
        stopInterval,
        calcRemaining,
        calcElapsed,
        isLongBreakDue,
        tick,
        resetToIdle,
        enterBreakPhase,
        enterFocusPhase,
        transitionToNextFocusOrIdle
    }

    // ---- Event dispatch ----
    const dispatch = (event: MachineEvent) => {
        const key = stateKey(phase.value, status.value)
        const transitions = transitionTable[key]
        if (!transitions) return

        const entry = transitions[event.type]
        if (!entry) return

        // Check guard
        if (entry.guard) {
            // Pass event as second arg for guards that need event data
            const guardFn = entry.guard as (ctx: MachineContext, event?: MachineEvent) => boolean
            if (!guardFn(ctx, event)) return
        }

        // Execute action
        if (entry.action) {
            const actionFn = entry.action as (ctx: MachineContext, event?: MachineEvent) => void
            actionFn(ctx, event)
        }

        // Note: 由于 counters 使用对象包装，actions 中的修改会自动同步，无需手动同步
    }

    // ---- Config update (special: not a state transition) ----
    const updateConfig = (newConfig: {
        focusDuration?: number
        breakDuration?: number
        longBreakDuration?: number
        sessionsUntilLongBreak?: number
        autoRest?: boolean
        autoStartNextFocusSession?: boolean
        autoStartNextFocusSessionCount?: number
    }) => {
        if (newConfig.focusDuration !== undefined) {
            options.config.focusDuration = newConfig.focusDuration
            ctx.config.focusDuration = newConfig.focusDuration
            if (phase.value === 'idle') {
                totalSeconds.value = newConfig.focusDuration
                remainingSeconds.value = newConfig.focusDuration
            }
        }
        if (newConfig.breakDuration !== undefined) {
            options.config.breakDuration = newConfig.breakDuration
            ctx.config.breakDuration = newConfig.breakDuration
        }
        if (newConfig.longBreakDuration !== undefined) {
            options.config.longBreakDuration = newConfig.longBreakDuration
            ctx.config.longBreakDuration = newConfig.longBreakDuration
        }
        if (newConfig.sessionsUntilLongBreak !== undefined) {
            options.config.sessionsUntilLongBreak = newConfig.sessionsUntilLongBreak
            ctx.config.sessionsUntilLongBreak = newConfig.sessionsUntilLongBreak
        }
        if (newConfig.autoRest !== undefined) {
            options.config.autoRest = newConfig.autoRest
            ctx.config.autoRest = newConfig.autoRest
        }
        if (newConfig.autoStartNextFocusSession !== undefined) {
            options.config.autoStartNextFocusSession = newConfig.autoStartNextFocusSession
            ctx.config.autoStartNextFocusSession = newConfig.autoStartNextFocusSession
        }
        if (newConfig.autoStartNextFocusSessionCount !== undefined) {
            options.config.autoStartNextFocusSessionCount = newConfig.autoStartNextFocusSessionCount
            ctx.config.autoStartNextFocusSessionCount = newConfig.autoStartNextFocusSessionCount
        }
    }

    // ---- Public API (mirrors useTimer for drop-in compatibility) ----
    const start = () => dispatch({ type: 'START' })
    const pause = () => dispatch({ type: 'PAUSE' })
    const resume = () => dispatch({ type: 'RESUME' })
    const reset = () => dispatch({ type: 'RESET' })
    const skip = () => dispatch({ type: 'SKIP' })
    const adjustTime = (delta: number) => dispatch({ type: 'ADJUST_TIME', delta })

    // ---- Cleanup ----
    onBeforeUnmount(() => {
        stopInterval()
        document.removeEventListener('visibilitychange', handleVisibilityChange)
    })

    return {
        phase: computed(() => phase.value),
        isIdle: computed(() => phase.value === 'idle'),
        isRunning: computed(() => status.value === 'running'),
        remainingSeconds,
        totalSeconds,
        start,
        pause,
        resume,
        reset,
        skip,
        adjustTime,
        updateConfig
    }
}
