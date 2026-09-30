import { PomodoroRecordUseCase, PomodoroUseCase } from '@nao-todo/domain-pomodoro'
import type { PomodoroRecordViewObject } from '@nao-todo/domain-pomodoro'
import { TaskUseCase } from '@nao-todo/domain-task'
import { DialogManager, Subscriber } from '@nao-todo/shared/hooks'
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

    // T451：今日专注记录（entry 级唯一 loader ⇒ 页面级侧栏常驻；避免多 loader 覆盖订阅）
    /** 今日专注记录（当日区间、startAt:desc） */
    todayRecords: Ref<PomodoroRecordViewObject[]>
    /** 首屏/分页加载中 */
    recordLoading: Ref<boolean>
    /** 已加载全部（禁下拉） */
    recordIsDone: Ref<boolean>
    /** 加载下一页 */
    handleNextPage: () => Promise<void>
}

// 番茄钟视图上下文键
export const POMODORO_VIEW_CONTEXT_KEY: InjectionKey<PomodoroViewContext> =
    Symbol('POMODORO_VIEW_CONTEXT')