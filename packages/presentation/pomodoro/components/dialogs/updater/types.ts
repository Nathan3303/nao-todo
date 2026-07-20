import type { DialogManager } from '@nao-todo/shared'
import type { PomodoroUseCase } from '@nao-todo/application/pomodoro/usecases'
import type { PomodoroFormState } from '../../form/types'

// 常用番茄专注编辑对话框 props
export type PomodoroUpdaterDialogProps = {
    pomodoroUseCase: PomodoroUseCase
    dialogManager: DialogManager
}

// 常用番茄专注编辑对话框表单状态
export type PomodoroUpdaterDialogFormState = PomodoroFormState

