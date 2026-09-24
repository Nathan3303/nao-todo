import type { LocationQueryRaw, RouteLocationRaw } from 'vue-router'
import type { CalendarViewMode } from '@/components/calendar/use-calendar-host'

/**
 * 日历三子路由名 → 视图态映射（C5 视图态单一真源）
 * @description `viewMode` 只读派生自 `route.name`；映射表穷举三条子路由名。
 *              测试断言「路由表名集合 ⊆ 映射键集合」，防未来改名后静默回落月视图。
 */
export const CALENDAR_VIEW_NAMES = {
    'calendar-monthly': 'month',
    'calendar-weekly': 'week',
    'calendar-day': 'day'
} as const satisfies Record<string, CalendarViewMode>

export type CalendarViewName = keyof typeof CALENDAR_VIEW_NAMES

export const isCalendarViewName = (name: unknown): name is CalendarViewName =>
    typeof name === 'string' && Object.prototype.hasOwnProperty.call(CALENDAR_VIEW_NAMES, name)

/** 已知日历子路由名 → 视图态；未知/父级/离开日历 → month（宿主卸载过程中的兜底） */
export const viewModeOfRouteName = (name: unknown): CalendarViewMode =>
    isCalendarViewName(name) ? CALENDAR_VIEW_NAMES[name] : 'month'

/**
 * 切视图导航目标（C10）
 * @description 幂等短路（目标 fullPath 与当前一致 → null，避免冗余 replace）；
 *              `taskId` 与 `query` 原样透传。返回 null 表示无需导航。
 */
export const resolveViewSwitch = (
    router: { resolve: (target: RouteLocationRaw) => { fullPath: string } },
    route: {
        fullPath: string
        params: { taskId?: string | string[] }
        query: LocationQueryRaw
    },
    name: CalendarViewName
): RouteLocationRaw | null => {
    const taskId = route.params.taskId
    const target: RouteLocationRaw = {
        name,
        params: taskId ? { taskId } : {},
        query: route.query
    }
    if (router.resolve(target).fullPath === route.fullPath) return null
    return target
}