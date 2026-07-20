import type { AuthUseCase } from '@nao-todo/application/auth/usecases'
import type { TaskUseCase } from '@nao-todo/application/task/usecases'
import type { UserUseCase } from '@nao-todo/application/user/usecases'
import type { DialogManager, Subscriber } from '@nao-todo/shared'
import type { InjectionKey, Ref } from 'vue'

// 日历视图上下文
export type CalendarViewContext = {
    authUseCase: AuthUseCase
    userUseCase: UserUseCase
    taskUseCase: TaskUseCase

    dialogManager: DialogManager
    subscriber: Subscriber

    asideWidth: Ref<string>
    isDisplayAside: Ref<boolean>
    isUseFloatAside: Ref<boolean>
    switchDisplayAside: () => void
    handleResizeAside: (newWidth: number) => void
}

// 日历视图上下文注入键
export const CALENDAR_VIEW_CONTEXT_KEY: InjectionKey<CalendarViewContext> =
    Symbol('CALENDAR_VIEW_CONTEXT')
