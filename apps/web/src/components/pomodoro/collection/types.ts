import type { DialogManager } from '@nao-todo/shared'
import type { PomodoroRecordUseCase, PomodoroUseCase } from '@nao-todo/application/pomodoro/usecases'

// 常用专注组件 props
export type PomodoroCollectionProps = {
    pomodoroUseCase: PomodoroUseCase
    pomodoroRecordUseCase: PomodoroRecordUseCase
    dialogManager: DialogManager
}

