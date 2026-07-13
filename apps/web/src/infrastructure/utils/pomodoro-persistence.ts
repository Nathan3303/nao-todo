/**
 * 番茄专注 / 正计时 计时快照持久化
 * @description 在计时激活期间将快照写入 localStorage，页面刷新后可通过绝对时间戳
 *              的时间差恢复计时状态，避免误刷新导致计时数据丢失、还原到 idle。
 */

/** 倒计时快照存储键名 */
const POMODORO_TIMER_SNAPSHOT_KEY = 'POMODORO_TIMER_SNAPSHOT'

/** 正计时快照存储键名 */
const POMODORO_FOCUS_SNAPSHOT_KEY = 'POMODORO_FOCUS_SNAPSHOT'

/**
 * 会话信息（记录创建所需，跨刷新持久化）
 */
export interface PomodoroSession {
    taskId: string | null
    taskName: string
    pomodoroId: string | null
    pomodoroName: string
    noteText: string
}

/**
 * 倒计时快照
 */
export interface TimerSnapshot {
    phase: 'focus' | 'break' | 'longBreak' // 不持久化 idle
    status: 'running' | 'paused'
    totalSeconds: number
    targetEndTime: number // 绝对 ms，running 有效
    pausedRemainingMs: number // paused 有效
    breakWarningSent: boolean
    completedRoundCount: number
    autoStartCount: number
    recordId: string | null
    recordStartAt: string | null
    session: PomodoroSession
    savedAt: number
}

/**
 * 正计时快照
 */
export interface FocusSnapshot {
    status: 'running' | 'paused'
    accumulatedMs: number
    startTimestamp: number // 绝对 ms，running 有效
    sessionId: string | null
    recordStartedAt: string | null
    session: PomodoroSession
    savedAt: number
}

// ============================================================================
// Timer（倒计时）
// ============================================================================

/** 保存倒计时快照 */
export const saveTimerSnapshot = (snapshot: TimerSnapshot) => {
    try {
        localStorage.setItem(POMODORO_TIMER_SNAPSHOT_KEY, JSON.stringify(snapshot))
    } catch (error) {
        console.error('Failed to save pomodoro timer snapshot to localStorage:', error)
    }
}

/** 读取倒计时快照，无数据或出错返回 null */
export const loadTimerSnapshot = (): TimerSnapshot | null => {
    try {
        const saved = localStorage.getItem(POMODORO_TIMER_SNAPSHOT_KEY)
        if (!saved) return null
        return JSON.parse(saved) as TimerSnapshot
    } catch (error) {
        console.error('Failed to load pomodoro timer snapshot from localStorage:', error)
        return null
    }
}

/** 清除倒计时快照 */
export const clearTimerSnapshot = () => {
    try {
        localStorage.removeItem(POMODORO_TIMER_SNAPSHOT_KEY)
    } catch (error) {
        console.error('Failed to clear pomodoro timer snapshot from localStorage:', error)
    }
}

// ============================================================================
// Focus（正计时）
// ============================================================================

/** 保存正计时快照 */
export const saveFocusSnapshot = (snapshot: FocusSnapshot) => {
    try {
        localStorage.setItem(POMODORO_FOCUS_SNAPSHOT_KEY, JSON.stringify(snapshot))
    } catch (error) {
        console.error('Failed to save pomodoro focus snapshot to localStorage:', error)
    }
}

/** 读取正计时快照，无数据或出错返回 null */
export const loadFocusSnapshot = (): FocusSnapshot | null => {
    try {
        const saved = localStorage.getItem(POMODORO_FOCUS_SNAPSHOT_KEY)
        if (!saved) return null
        return JSON.parse(saved) as FocusSnapshot
    } catch (error) {
        console.error('Failed to load pomodoro focus snapshot from localStorage:', error)
        return null
    }
}

/** 清除正计时快照 */
export const clearFocusSnapshot = () => {
    try {
        localStorage.removeItem(POMODORO_FOCUS_SNAPSHOT_KEY)
    } catch (error) {
        console.error('Failed to clear pomodoro focus snapshot from localStorage:', error)
    }
}
