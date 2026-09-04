import { AuthUseCase, UserUseCase } from '@nao-todo/domain-identity'
import { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import type { DialogManager, Subscriber } from '@nao-todo/shared'
import type { InjectionKey, Ref } from 'vue'

// 任务筛选范围（头部范围菜单快捷设置；仅清单/标签，不含内置清单）
export type CalendarTaskScope =
    | { type: 'project'; id: string }
    | { type: 'tag'; id: string }
    | { type: 'all' }

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

    /** 打开任务详情（日历区内嵌详情抽屉） */
    showTaskDetails: (taskId: TaskViewObject['id']) => void

    // —— 任务筛选状态（侧边栏复选框与头部范围菜单同源） ——
    /** 勾选的清单（多选，组内 OR） */
    selectedProjectIds: Ref<string[]>
    /** 勾选的标签（多选，组内 OR） */
    selectedTagIds: Ref<string[]>
    /** 隐藏已完成任务（独立显示开关） */
    hideCompleted: Ref<boolean>
    /** 清除清单/标签两组筛选（不影响 hideCompleted） */
    clearFilter: () => void
    /** 快捷设置单一范围（替换式：仅选中一个清单或标签；all 清空两组） */
    applyScope: (scope: CalendarTaskScope) => void
}

// 日历视图上下文注入键
export const CALENDAR_VIEW_CONTEXT_KEY: InjectionKey<CalendarViewContext> =
    Symbol('CALENDAR_VIEW_CONTEXT')