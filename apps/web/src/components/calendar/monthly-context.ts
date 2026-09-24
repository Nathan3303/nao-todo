import type { InjectionKey, Ref } from 'vue'
import type useCalendarMonthly from './monthly/use-calendar-monthly'
import type { useDragSchedule } from './monthly/use-drag-schedule'

/**
 * 月视图上下文（宿主上移后）
 * @description 状态宿主（`use-calendar-host.ts`）provide；月视图渲染件
 *              `monthly/month-grid.vue` inject 消费。含 `useCalendarMonthly` 的全部
 *              结果态/动作 + 宿主独有派生（`laneLimit`/`drag`/抽屉/视图切换/角标）。
 */
export type CalendarMonthlyContext = ReturnType<typeof useCalendarMonthly> & {
    /** 网格实测可视轨道数（宿主持有，月视图测量写回，宿主 `model` 依赖） */
    laneLimit: Ref<number>
    /** 宿主唯一拖拽会话（月视图任务条拖起/落点高亮消费） */
    drag: ReturnType<typeof useDragSchedule>
    /** 打开当日面板（宿主抽屉） */
    onOpenDay: (dateKey: string) => void
    /** 打开未安排抽屉（宿主抽屉） */
    onOpenUnscheduled: () => void
    /** 收起未安排抽屉 */
    onCloseUnscheduled: () => void
    /** 视图切换（路由导航 / standalone 内部态） */
    onGoWeekView: () => void
    onGoDayView: () => void
    /** 专注角标标签（'' = 不显示） */
    badgeLabel: (dateKey: string) => string
    /** 未安排按钮禁用态（宿主派生） */
    unscheduledDisabled: Ref<boolean>
    /** 筛选激活态（宿主派生） */
    filterActive: Ref<boolean>
}

export const CALENDAR_MONTHLY_CONTEXT_KEY: InjectionKey<CalendarMonthlyContext> = Symbol(
    'calendar-monthly-context'
)