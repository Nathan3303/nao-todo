<script setup lang="ts">
import { Loading as LoadingComp } from '@nao-todo/shared'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { computed, inject, nextTick, ref, watch } from 'vue'
import dayjs from 'dayjs'
import QuickCreate from '../monthly/quick-create.vue'
import TaskBar from '../monthly/task-bar.vue'
import { buildWeekGrid, GRID_COLUMNS, weekdaysOf } from '../monthly/monthly-layout'
import { segmentStyleOf, useCalendarGrid } from '../monthly/use-calendar-grid'
import { useMonthJump } from '../monthly/use-month-jump'
import CalendarMonthGrid from '../monthly/calendar-month-grid.vue'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { isInteractiveKeyTarget } from '../monthly/keyboard-nav'
import { buildCalendarEmptyState } from '../monthly/empty-state'
import { CALENDAR_WEEKLY_CONTEXT_KEY } from '../weekly-context'
import CalendarSortDropdown from '../monthly/calendar-sort-dropdown.vue'

import '../calendar-grid.css'

defineOptions({ name: 'CalendarWeekly' })

// —— O14 props 收敛：周视图上下文由月视图（父）provide，本组件直接 inject 消费 ——
const {
    loading,
    error,
    onRetry,
    tasks,
    sort,
    selectedKey,
    filterActive,
    hideCompleted,
    onClearFilter,
    onShowCompleted,
    onOpenDay,
    onOpenTask,
    onGoMonth,
    onPrevWeek,
    onNextWeek,
    onGoToday,
    unscheduledCount,
    unscheduledDisabled,
    onOpenUnscheduled,
    quickCreateDate,
    quickPending,
    onQuickOpen,
    onQuickCancel,
    onQuickSubmit,
    weekStart,
    busyTaskId,
    onRescheduleTask,
    dragActive,
    dragTaskId,
    dragHoverKey,
    onDragBar,
    onJumpYearMonth,
    onBadgeLabel
} = inject(CALENDAR_WEEKLY_CONTEXT_KEY)!

// @viewContext 应用级子侧栏开关（与月视图 header 一致）
const { isDisplayAside, switchDisplayAside } = inject(INDEX_VIEW_CONTEXT_KEY)!

// —— O2 网格共享几何 + DEF-2 动态可视轨道数（行高实测；首帧回退 3） ——
const bodyEl = ref<HTMLElement | null>(null)
const { laneLimit, measure: measureAndApplyLaneLimit } = useCalendarGrid({
    containerEl: bodyEl,
    rowSelector: '.wk-row'
})

// @computed 星期表头（随周起始口径）
const weekdays = computed(() => weekdaysOf(weekStart.value))

// @computed 周模型（锚点=selectedKey 所在周；跨周任务裁剪，复用 buildRowContent）
const model = computed(() =>
    buildWeekGrid(selectedKey.value, tasks.value, laneLimit.value, weekStart.value)
)

const visibleSegments = computed(() =>
    model.value.segments.filter((seg) => seg.lane < laneLimit.value)
)

// @computed 周范围标题：同月「9月 · 1日–7日」；跨月「8/31 – 9/6」
const title = computed(() => {
    const first = dayjs(model.value.days[0]?.dateKey)
    const last = dayjs(model.value.days[GRID_COLUMNS - 1]?.dateKey)
    if (!first.isValid() || !last.isValid()) return ''
    if (first.month() === last.month() && first.year() === last.year()) {
        return `${first.month() + 1}月 · ${first.date()}日–${last.date()}日`
    }
    return `${first.month() + 1}/${first.date()} – ${last.month() + 1}/${last.date()}`
})

// @computed 空态：真无 vs 筛选导致（出口与月视图一致）
const weekHasTasks = computed(() => model.value.segments.length > 0)
// @computed 空态（O6 统一工厂：与月视图/未安排抽屉同源；真无时由视图自行渲染「本周暂无任务」）
const emptyHint = computed(() =>
    buildCalendarEmptyState({
        hasTasks: weekHasTasks.value,
        filterActive: filterActive.value,
        hideCompleted: hideCompleted.value,
        filterText: '当前筛选条件下本周暂无任务',
        hideCompletedText: '已隐藏已完成任务',
        emptyText: null,
        onClearFilter,
        onShowCompleted
    })
)

// @method 按行高计算可视条数（同月视图 DEF-2 公式；measure 由 useCalendarGrid 提供）
// @lifecycle 高度观测（ResizeObserver + 防抖）与卸载清理已内置 useCalendarGrid
watch(
    [() => loading.value, () => error.value, () => tasks.value, () => weekHasTasks.value],
    () => {
        void nextTick(measureAndApplyLaneLimit)
    },
    { flush: 'post' }
)

// @method 任务条定位（7 列等分；top 按轨道步进；O2 共享几何纯函数）
const segStyle = segmentStyleOf

// @method 段首是否显示开始时刻：仅当任务真起始落在本周内可见列
const segShowTime = (seg: { task: TaskViewObject; isStart: boolean; colStart: number }): boolean =>
    !!seg.isStart && !!seg.task.startAt && dayjs(seg.task.startAt).isValid()

// @method 回车提交（dateKey 来自所在格条带）
const quickSubmitCell = (dateKey: string, name: string) => {
    void onQuickSubmit(dateKey, name)
}

// @method 日期格 Enter 激活（O7 焦点管理：与点击同语义；格内交互控件/输入放行原生行为）
const onCellEnter = (event: KeyboardEvent, dateKey: string): void => {
    if (event.key !== 'Enter') return
    if (isInteractiveKeyTarget(event.target)) return
    event.stopPropagation()
    event.preventDefault()
    onOpenDay(dateKey)
}

// @method 溢出 +N 与 点击日期格（打开当日面板）
const overflowOn = (dateKey: string) => model.value.overflow.find((o) => o.dateKey === dateKey)

// —— C2-F9 周视图标题年-月跳转（TASK-09：NueDropdown 触发器；O2 抽取 useMonthJump；落周不切回月视图） ——
// 面板锚点年 = 当前锚点（选中日）所在年；非法回退今天
const jumpAnchorYear = computed(() => {
    const anchor = dayjs(selectedKey.value)
    return anchor.isValid() ? anchor.year() : dayjs().year()
})
// 调用点解构为顶层 ref（模板嵌套 ref 不解包；:active="wjpOpen" 顶层解包，REG-01）
const {
    titleEl: wjpTitleEl,
    open: wjpOpen,
    onOpen: onWeekJumpOpen,
    onClose: onWeekJumpClose,
    onExecute: onWeekJumpExecute
} = useMonthJump({
    onSelect: (year, month) => onJumpYearMonth(year, month)
})
</script>

<template>
    <nue-div vertical class="nue-calendar-weekly" gap="0">
        <!-- 周导航 -->
        <nue-div align="center" class="wk-header" gap="8px">
            <nue-div align="center" gap="2px">
                <nue-button
                    :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                    theme="icon,ghost"
                    @click="switchDisplayAside"
                />
                <nue-button
                    icon="arrow-left"
                    theme="icon,ghost"
                    title="上一周"
                    @click="onPrevWeek"
                />
                <!-- 年-月跳转 NueDropdown（TASK-09：NueDropdown 内建开合/定位/Esc/外点；
                     closeWhenExecuted 月格即点即跳即关；落周不切回月视图） -->
                <nue-dropdown
                    placement="bottom-start"
                    size="small"
                    group="calendar-month-jump"
                    close-when-executed
                    @open="onWeekJumpOpen"
                    @close="onWeekJumpClose"
                    @execute="onWeekJumpExecute"
                >
                    <template #trigger="{ trigger }">
                        <button
                            ref="wjpTitleEl"
                            type="button"
                            class="wk-title"
                            title="跳转到年月"
                            @click="trigger"
                        >
                            {{ title }}
                        </button>
                    </template>
                    <calendar-month-grid :anchor-year="jumpAnchorYear" :active="wjpOpen" />
                </nue-dropdown>
                <nue-button
                    icon="arrow-right"
                    theme="icon,ghost"
                    title="下一周"
                    @click="onNextWeek"
                />
            </nue-div>
            <nue-div align="center" gap="6px">
                <calendar-sort-dropdown v-model="sort" />
                <nue-div class="wk-view-toggle" role="group" aria-label="视图切换">
                    <nue-button
                        theme="small,ghost"
                        class="wk-view-btn"
                        title="切回月视图"
                        aria-pressed="false"
                        @click="onGoMonth"
                    >
                        月
                    </nue-button>
                    <nue-button
                        theme="small,ghost"
                        class="wk-view-btn is-active"
                        title="当前：周视图"
                        aria-pressed="true"
                        @click="onGoMonth"
                    >
                        周
                    </nue-button>
                </nue-div>
                <span class="wk-view-sep" aria-hidden="true"></span>
                <nue-button
                    theme="ghost,small"
                    :disabled="unscheduledDisabled"
                    title="未安排任务：快速安排到某日"
                    @click="onOpenUnscheduled"
                >
                    未安排 {{ unscheduledCount }}
                </nue-button>
                <nue-button theme="ghost,small" @click="onGoToday">今天</nue-button>
            </nue-div>
        </nue-div>

        <!-- 星期表头 -->
        <nue-div class="wk-weekdays" gap="0">
            <div v-for="day in weekdays" :key="day" class="wk-weekday">{{ day }}</div>
        </nue-div>

        <!-- 周主体（7 列单行 + 任务条层） -->
        <div ref="bodyEl" class="wk-body">
            <div v-if="loading" class="wk-state">
                <loading-comp height="100%" />
            </div>
            <div v-else-if="error" class="wk-state">
                <nue-div vertical align="center" gap="8px">
                    <nue-text size="var(--nue-text-sm)">{{ error }}</nue-text>
                    <nue-button theme="primary,small" @click="onRetry">重试</nue-button>
                </nue-div>
            </div>
            <div v-else-if="emptyHint" class="wk-state">
                <nue-div vertical align="center" gap="8px">
                    <nue-text size="var(--nue-text-sm)">{{ emptyHint.text }}</nue-text>
                    <nue-button theme="primary,small" @click="emptyHint.run">
                        {{ emptyHint.action }}
                    </nue-button>
                </nue-div>
            </div>
            <div v-else-if="!weekHasTasks" class="wk-state">
                <nue-text size="var(--nue-text-sm)">本周暂无任务</nue-text>
            </div>
            <!-- 网格 -->
            <div v-else class="wk-row" role="row">
                <div
                    v-for="cell in model.days"
                    :key="cell.dateKey"
                    class="wk-cell"
                    role="gridcell"
                    tabindex="0"
                    :aria-selected="cell.isSelected"
                    :data-cal-drop="cell.dateKey"
                    :class="{
                        'wk-cell--outside': cell.monthOffset !== 0,
                        'wk-cell--today': cell.isToday,
                        'wk-cell--selected': cell.isSelected,
                        'wk-cell--weekend': cell.isWeekend,
                        'wk-cell--drop': dragActive && dragHoverKey === cell.dateKey
                    }"
                    @keydown="onCellEnter($event, cell.dateKey)"
                >
                    <span class="wk-cell-top">
                        <span class="wk-date">{{ cell.day }}</span>
                        <span
                            v-if="onBadgeLabel(cell.dateKey)"
                            class="wk-badge"
                            :title="`当日完成 ${onBadgeLabel(cell.dateKey)} 轮专注`"
                        >
                            {{ onBadgeLabel(cell.dateKey) }}
                        </span>
                    </span>
                    <div class="wk-band" @click.stop>
                        <template v-if="quickCreateDate === cell.dateKey">
                            <quick-create
                                :pending="quickPending"
                                @submit="(name) => quickSubmitCell(cell.dateKey, name)"
                                @cancel="onQuickCancel"
                            />
                        </template>
                        <template v-else>
                            <button
                                v-if="cell.monthOffset === 0"
                                type="button"
                                class="wk-quick-add"
                                title="快速新建"
                                @click.stop="onQuickOpen(cell.dateKey)"
                            >
                                +
                            </button>
                            <button
                                v-if="overflowOn(cell.dateKey)"
                                type="button"
                                class="wk-more"
                                :title="`还有 ${overflowOn(cell.dateKey)!.count} 个任务`"
                                @click.stop="onOpenDay(cell.dateKey)"
                            >
                                +{{ overflowOn(cell.dateKey)!.count }}
                            </button>
                        </template>
                    </div>
                </div>
                <!-- 任务条层 -->
                <div class="cal-lanes" role="presentation">
                    <task-bar
                        v-for="seg in visibleSegments"
                        :key="`${seg.task.id}-${seg.colStart}`"
                        :task="seg.task"
                        :pos="segStyle(seg)"
                        :show-time="segShowTime(seg)"
                        :cont-start="!seg.isStart && seg.colStart === 0"
                        :cont-end="!seg.isEnd && seg.colEnd === GRID_COLUMNS - 1"
                        :busy="busyTaskId === seg.task.id"
                        :dragging="dragActive && dragTaskId === seg.task.id"
                        @open="onOpenTask(seg.task.id)"
                        @reschedule="(dateKey) => onRescheduleTask(seg.task, dateKey)"
                        @drag-pointer-down="(event) => onDragBar(seg.task, event)"
                    />
                </div>
                <!-- 网格分隔线覆盖层（TASK-07：线在任务条上方，pointer-events:none） -->
                <div class="cal-lines" role="presentation"></div>
            </div>
        </div>
    </nue-div>
</template>

<style scoped>
/* ── 周视图根布局（令牌与网格样式已归并至 calendar-grid.css） ── */
.nue-calendar-weekly {
    flex: 1;
    min-height: 0;
    overflow: hidden;
}
</style>