import Timer from './timer.vue'

export const PomodoroTimerComp = Timer
export type {
    TimerPhase,
    TimerStatus,
    TimerState,
    TimerConfig,
    PomodoroRecordViewObject
} from './types'
export { useTimer } from './use-timer'
export { usePomodoroStateMachine } from './use-pomodoro-state-machine'
export type { StateMachineCallbacks, StateMachineConfig } from './use-pomodoro-state-machine'
