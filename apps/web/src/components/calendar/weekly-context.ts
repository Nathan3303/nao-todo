import type { InjectionKey, Ref } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import type { CalendarWeekStart } from './monthly/monthly-layout'

/**
 * 周视图上下文（O14 props 收敛）
 * @description 月视图（父组件）provide 周视图所需的全部视图状态与动作；
 *              weekly 组件不再穿透 33 个 props，改由 inject 获取（消除 prop drilling）。
 *              状态以 Ref 提供保持响应式；动作即 UI 层回调（业务依赖仍在 composable 内组装）。
 */
export type CalendarWeeklyContext = {
    loading: Ref<boolean>
    error: Ref<string>
    onRetry: () => void
    tasks: Ref<TaskViewObject[]>
    selectedKey: Ref<string>
    filterActive: Ref<boolean>
    hideCompleted: Ref<boolean>
    onClearFilter: () => void
    onShowCompleted: () => void
    onOpenDay: (dateKey: string) => void
    onOpenTask: (taskId: TaskViewObject['id']) => void
    onGoMonth: () => void
    onPrevWeek: () => void
    onNextWeek: () => void
    onGoToday: () => void
    unscheduledCount: Ref<number>
    unscheduledDisabled: Ref<boolean>
    onOpenUnscheduled: () => void
    // —— 格内快速新建（B6） ——
    quickCreateDate: Ref<string>
    quickPending: Ref<boolean>
    onQuickOpen: (dateKey: string) => void
    onQuickCancel: () => void
    onQuickSubmit: (dateKey: string, name: string) => void | Promise<boolean>
    /** 周起始口径（C9） */
    weekStart: Ref<CalendarWeekStart>
    /** 单条改期写回中的任务 ID（F4 逐任务 busy） */
    busyTaskId: Ref<string>
    onRescheduleTask: (task: TaskViewObject, dateKey: string) => void | Promise<void>
    // —— F1 拖拽：会话激活态 / 被拖任务 ID / 当前高亮日期键 / 任务条左键按下 ——
    dragActive: Ref<boolean>
    dragTaskId: Ref<string>
    dragHoverKey: Ref<string | null>
    onDragBar: (task: TaskViewObject, event: PointerEvent) => void
    /** C2-F9 周视图标题年-月跳转（落含 1 号的周并选中 1 号，不切回月视图） */
    onJumpYearMonth: (year: number, month: number) => void
    /** B1-F5 专注角标：取某日标签（'' = 不显示） */
    onBadgeLabel: (dateKey: string) => string
}

export const CALENDAR_WEEKLY_CONTEXT_KEY: InjectionKey<CalendarWeeklyContext> =
    Symbol('calendar-weekly-context')