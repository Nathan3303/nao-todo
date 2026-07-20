import type { DialogManager } from '@nao-todo/shared'
import type { PomodoroUseCase } from '../../../usecases'
import type { PomodoroFormState } from '../../form/types'

// 常用番茄专注创建对话框属性
export type PomodoroCreatorDialogProps = {
    pomodoroUseCase: PomodoroUseCase
    dialogManager: DialogManager
}

// 常用番茄专注创建对话框表单状态
export type PomodoroCreatorDialogFormStates = PomodoroFormState

