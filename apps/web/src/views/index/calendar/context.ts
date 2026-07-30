import { AuthUseCase, UserUseCase } from '@nao-todo/domain-identity'
import { TaskUseCase } from '@nao-todo/domain-task'
import type { DialogManager, Subscriber } from '@nao-todo/shared'
import type { InjectionKey, Ref } from 'vue'

// 日历视图上下文
export type CalendarViewContext = {
    authUseCase: AuthUseCase
    userUseCase: UserUseCase
    taskUseCase: TaskUseCase

    dialogManager: DialogManager
    subscriber: Subscriber

    isDisplayAside: Ref<boolean>
    isUseFloatAside: Ref<boolean>
    switchDisplayAside: () => void
}

// 日历视图上下文注入键
export const CALENDAR_VIEW_CONTEXT_KEY: InjectionKey<CalendarViewContext> =
    Symbol('CALENDAR_VIEW_CONTEXT')