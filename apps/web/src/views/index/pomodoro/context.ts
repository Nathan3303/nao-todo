
import { PomodoroUseCase } from '@nao-todo/application/pomodoro/usecases'
import { TaskUseCase } from '@nao-todo/application/task/usecases'
import { DialogManager, Subscriber } from '@nao-todo/shared'
import type { InjectionKey, Ref } from 'vue'

// 番茄钟视图上下文
export type PomodoroViewContext = {
    taskUseCase: TaskUseCase
    pomodoroUseCase: PomodoroUseCase

    dialogManager: DialogManager
    subscriber: Subscriber

    asideWidth: Ref<string>
    isDisplayAside: Ref<boolean>
    isUseFloatAside: Ref<boolean>
    handleResizeAside: (width: number) => void
    switchDisplayAside: () => void

    getProjectName: (projectId: string) => string
    showTaskDetails: (taskId: string) => void
}

// 番茄钟视图上下文键
export const POMODORO_VIEW_CONTEXT_KEY: InjectionKey<PomodoroViewContext> =
    Symbol('POMODORO_VIEW_CONTEXT')




