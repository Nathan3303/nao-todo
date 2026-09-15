import { describe, expect, it, vi } from 'vite-plus/test'
import { buildCalendarEmptyState, type CalendarEmptyStateParams } from '../empty-state'

/**
 * 空态工厂纯逻辑（O6 统一单源）
 * @description 分支口径：有任务 → 筛选激活 → 隐藏已完成 → 缺省文案（可空）；动作文案/回调注入。
 */
const makeParams = (
    overrides: Partial<CalendarEmptyStateParams> = {}
): CalendarEmptyStateParams => ({
    hasTasks: false,
    filterActive: false,
    hideCompleted: false,
    filterText: '筛选空态',
    hideCompletedText: '隐藏完成空态',
    emptyText: '缺省空态',
    onClearFilter: vi.fn(),
    onShowCompleted: vi.fn(),
    ...overrides
})

describe('buildCalendarEmptyState - 空态分支工厂', () => {
    it('有任务 → null（筛选/隐藏激活也优先返回网格）', () => {
        expect(
            buildCalendarEmptyState(makeParams({ hasTasks: true, filterActive: true }))
        ).toBeNull()
        expect(
            buildCalendarEmptyState(makeParams({ hasTasks: true, hideCompleted: true }))
        ).toBeNull()
    })

    it('筛选激活优先于隐藏已完成 → 清除筛选出口', () => {
        const s = buildCalendarEmptyState(makeParams({ filterActive: true, hideCompleted: true }))
        expect(s).toEqual({ text: '筛选空态', action: '清除筛选', run: expect.any(Function) })
    })

    it('仅隐藏已完成 → 显示已完成出口', () => {
        const s = buildCalendarEmptyState(makeParams({ hideCompleted: true }))
        expect(s).toEqual({ text: '隐藏完成空态', action: '显示已完成', run: expect.any(Function) })
    })

    it('真无任务 + 缺省文案 → 无动作空态；emptyText null → null', () => {
        const s = buildCalendarEmptyState(makeParams())
        expect(s).toEqual({ text: '缺省空态', action: '', run: expect.any(Function) })
        expect(buildCalendarEmptyState(makeParams({ emptyText: null }))).toBeNull()
    })
})