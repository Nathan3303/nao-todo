import DialogManager from '@/infrastructure/hooks/use-dialog-manager'
import { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import { AuthUseCase } from '@nao-todo/usecases/auth'
import { TaskUseCase } from '@nao-todo/usecases/task'
import { UserUseCase } from '@nao-todo/usecases/user'
import { InjectionKey, Ref } from 'vue'

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


