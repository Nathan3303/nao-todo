import { computed, type Ref } from 'vue'
import { t } from '@nao-todo/shared'
import dayjs from 'dayjs'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { segmentStyleInColumns } from '../monthly/use-calendar-grid'
import { buildDayGrid, type DayGridModel } from './build-day-grid'
import type { DayAxisSpec } from './day-zoom'

/**
 * useDayModel —— 日视图模型与文案（TASK-16 C1 / TASK-19 D4·V1 / TASK-19B C6）
 * @description 纯派生视图模型（不发请求）：
 *              - `model`：唯一 `packLanes` 入口；`maxLanes = Infinity` ⇒ overflow 恒空、全部轨道渲染（V1）；
 *                `axis.columnMinutes` 为依赖 ⇒ 缩放重算模型（纯派生，AC7 安全）；
 *              - `segStyle`：几何仍必经 `segmentStyleInColumns`（列数来源 = 模型，C1）；
 *              - 标题 / 空态文案 / 全天只读条原因（`data-allday-reason` + title 后缀，C6 r3）。
 */

/** 全天只读条不可拖拽原因（机器可断言载体；C6） */
export type AllDayReason = 'span-over-24h' | 'end-only'

/** 原因文案（中文，两种；title 后缀用，**不覆盖任务名**） */
export const ALLDAY_REASON_TEXT: Record<AllDayReason, string> = {
    'span-over-24h': '全天任务，跨度超过 24 小时，日视图内不可拖拽',
    'end-only': '全天任务，仅设了截止时间，日视图内不可拖拽'
}

export type DayModelDeps = {
    anchorKey: Ref<string>
    todayKey: string
    tasks: Ref<TaskViewObject[]>
    axis: Ref<DayAxisSpec>
    filterActive: Ref<boolean>
    hideCompleted: Ref<boolean>
    onClearFilter: () => void
    onShowCompleted: () => void
}

export const useDayModel = ({
    anchorKey,
    todayKey,
    tasks,
    axis,
    filterActive,
    hideCompleted,
    onClearFilter,
    onShowCompleted
}: DayModelDeps) => {
    // @computed 日视图模型（分钟级连续定位；轨道 + 日级 +N 走唯一 packLanes）
    const model = computed<DayGridModel>(() =>
        buildDayGrid(anchorKey.value || todayKey, tasks.value, Number.POSITIVE_INFINITY, todayKey, {
            columnMinutes: axis.value.columnMinutes
        })
    )

    // @method 任务条定位（列数 = 模型列数；唯一几何实现 segmentStyleInColumns，C1）
    const segStyle = (seg: { colStart: number; colEnd: number; lane: number }) =>
        segmentStyleInColumns(seg, model.value.columns.length, 0)

    // @computed 标题（锚点日）
    const title = computed(() => {
        const anchor = dayjs(anchorKey.value)
        return anchor.isValid() ? anchor.format('YYYY 年 M 月 D 日') : ''
    })

    // @computed 空态文案（区分筛选/隐藏完成/真无）
    const emptyHint = computed(() => {
        if (model.value.timed.length > 0 || model.value.allDay.length > 0) return null
        if (filterActive.value)
            return { text: '当前筛选条件下，当日暂无任务', action: '清除筛选', run: onClearFilter }
        if (hideCompleted.value)
            return { text: '已隐藏已完成任务', action: '显示已完成', run: onShowCompleted }
        return { text: t('calendar.noTasksToday'), action: '', run: () => {} }
    })

    /** 全天原因分档：有 `startAt` ⇒ 跨整天；仅 `endAt` ⇒ 仅设截止时间 */
    const alldayReasonOf = (task: TaskViewObject): AllDayReason =>
        task.startAt ? 'span-over-24h' : 'end-only'

    return { model, segStyle, title, emptyHint, alldayReasonOf }
}