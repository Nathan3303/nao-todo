import { PomodoroRecordUseCase, PomodoroUseCase } from '@nao-todo/domain-pomodoro'
import { TaskUseCase } from '@nao-todo/domain-task'
import { DialogManager, Subscriber } from '@nao-todo/shared'
import type { InjectionKey, Ref } from 'vue'

// 番茄钟视图上下文
export type PomodoroViewContext = {
    taskUseCase: TaskUseCase
    pomodoroUseCase: PomodoroUseCase
    pomodoroRecordUseCase: PomodoroRecordUseCase

    dialogManager: DialogManager
    subscriber: Subscriber

    isDisplayAside: Ref<boolean>
    isUseFloatAside: Ref<boolean>
    switchDisplayAside: () => void

    getProjectName: (projectId: string) => string
    showTaskDetails: (taskId: string) => void
}

// 番茄钟视图上下文键
export const POMODORO_VIEW_CONTEXT_KEY: InjectionKey<PomodoroViewContext> =
    Symbol('POMODORO_VIEW_CONTEXT')