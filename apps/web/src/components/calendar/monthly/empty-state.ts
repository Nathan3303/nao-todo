/**
 * 日历空态统一工厂（O6 单源）
 * @description 月视图 / 周视图 / 未安排抽屉三处空态分支（有任务 → 筛选激活 → 隐藏已完成 → 缺省文案）
 *              收敛为单一工厂；分支口径与动作文案（清除筛选 / 显示已完成）单源，
 *              各视图仅注入自己的文案与回调，行为不再各自实现。
 */

export type CalendarEmptyState = {
    text: string
    action: string
    run: () => void
} | null

export type CalendarEmptyStateParams = {
    hasTasks: boolean
    filterActive: boolean
    hideCompleted: boolean
    /** 筛选激活时的空态文案 */
    filterText: string
    /** 仅隐藏已完成时的空态文案 */
    hideCompletedText: string
    /** 真无任务时的缺省文案；null = 无缺省空态（由视图自行渲染） */
    emptyText: string | null
    onClearFilter: () => void
    onShowCompleted: () => void
}

export const buildCalendarEmptyState = (p: CalendarEmptyStateParams): CalendarEmptyState => {
    if (p.hasTasks) return null
    if (p.filterActive) {
        return { text: p.filterText, action: '清除筛选', run: p.onClearFilter }
    }
    if (p.hideCompleted) {
        return { text: p.hideCompletedText, action: '显示已完成', run: p.onShowCompleted }
    }
    if (p.emptyText) return { text: p.emptyText, action: '', run: () => {} }
    return null
}