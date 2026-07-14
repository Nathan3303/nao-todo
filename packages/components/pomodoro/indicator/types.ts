export type PomodoroIndicatorProps = {
    route?: string
    progress?: number
    indicatorColor?: string
    phaseLabel?: string
    timeDisplay?: string
    taskName?: string
    isTimerRunning?: boolean
    isFocusRunning?: boolean
}

export type PomodoroIndicatorEmits = {
    (e: 'go'): void
}
