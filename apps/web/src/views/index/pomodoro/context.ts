import DialogManager from '@/infrastructure/hooks/use-dialog-manager'
import { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import { TaskUseCase } from '@nao-todo/usecases/task'
import { PomodoroUseCase } from '@nao-todo/usecases/pomodoro'
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




