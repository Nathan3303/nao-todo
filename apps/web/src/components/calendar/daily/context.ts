import type { InjectionKey, Ref } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import type { CalendarSort } from '../monthly/calendar-sort'

/**
 * 日视图上下文（TASK-16 C14）
 * @description 由组装点（`monthly/index.vue`，数据快照所有者）provide；日视图组件 inject 消费，
 *              复用同一 `sortedTasks` 快照 ⇒ **切视图不重拉数据**。
 *              组件在无 provider 时（单测/独立挂载）回退自足实现，注入契约仍为
 *              `CALENDAR_VIEW_CONTEXT_KEY` + Pinia（不改为 props 直传）。
 */
export type CalendarDayContext = {
    loading: Ref<boolean>
    error: Ref<string>
    onRetry: () => void
    /** 锚点日键（= 选中日） */
    anchorKey: Ref<string>
    /** 今天日键（注入，供 buildDayGrid 判定 isToday，不读真实时钟） */
    todayKey: string
    /** 已排序任务快照（用户排序） */
    tasks: Ref<TaskViewObject[]>
    /** 日历排序状态（复用同一状态源） */
    sort: Ref<CalendarSort>
    onOpenTask: (taskId: TaskViewObject['id']) => void
    /** 快速新建成功后广播（快照联动；月/周同款 AddNewTaskId） */
    onTaskCreated: (taskId: TaskViewObject['id']) => void
    onOpenUnscheduled: () => void
    onOpenDay: (dateKey: string) => void
    onPrevDay: () => void
    onNextDay: () => void
    onGoToday: () => void
    onGoMonth: () => void
    onGoWeek: () => void
    filterActive: Ref<boolean>
    hideCompleted: Ref<boolean>
    onClearFilter: () => void
    onShowCompleted: () => void
    unscheduledCount: Ref<number>
    unscheduledDisabled: Ref<boolean>
}

export const CALENDAR_DAY_CONTEXT_KEY: InjectionKey<CalendarDayContext> =
    Symbol('calendar-day-context')