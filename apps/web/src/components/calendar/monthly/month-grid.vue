<script setup lang="ts">
import { Loading as LoadingComp } from '@nao-todo/shared'
import { computed, inject, nextTick, ref, watch } from 'vue'
import QuickCreate from './quick-create.vue'
import TaskBar from './task-bar.vue'
import { buildCalendarEmptyState } from './empty-state'
import { showEndTimeInMonth } from './segment-time'
import { segmentStyleOf, useCalendarGrid } from './use-calendar-grid'
import { useMonthJump } from './use-month-jump'
import CalendarSortDropdown from './calendar-sort-dropdown.vue'
import CalendarMonthGrid from './calendar-month-grid.vue'
import { isInteractiveKeyTarget } from './keyboard-nav'
import {
    GRID_COLUMNS,
    GRID_ROWS,
    weekdaysOf,
    type CalendarOverflow,
    type CalendarRow,
    type CalendarSegment
} from './monthly-layout'
import { CALENDAR_MONTHLY_CONTEXT_KEY } from '../monthly-context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'

defineOptions({ name: 'CalendarMonthGrid' })

// @context 月视图上下文（宿主 provide；结果态/动作/拖拽/角标全部注入消费）
const {
    laneLimit,
    loading,
    error,
    retry,
    model,
    monthTitle,
    selectedKey,
    goPrevMonth,
    goNextMonth,
    goToToday,
    year,
    jumpToMonth,
    jumpToWeekOfMonthFirst,
    unscheduledTasks,
    sort,
    weekStart,
    selectedProjectIds,
    selectedTagIds,
    hideCompleted,
    clearFilter,
    openTaskDetails,
    onOpenDay,
    onOpenUnscheduled,
    onGoWeekView,
    onGoDayView,
    badgeLabel,
    unscheduledDisabled,
    filterActive,
    rescheduleBusyId,
    scheduleToDay,
    drag,
    quickCreateDate,
    quickCreatePending,
    openQuickCreate,
    closeQuickCreate,
    inlineCreateTask
} = inject(CALENDAR_MONTHLY_CONTEXT_KEY)!

// @viewContext 应用级子侧栏开关（与任务页 header 行为一致）
const { isDisplayAside, switchDisplayAside } = inject(INDEX_VIEW_CONTEXT_KEY)!

// —— O2 网格共享几何 + DEF-2 动态可视轨道数（行高实测；未测得前回退 3） ——
const calBodyEl = ref<HTMLElement | null>(null)
const {
    laneLimit: measuredLaneLimit,
    measure: measureAndApplyLaneLimit,
    attach: attachBodyObserver
} = useCalendarGrid({ containerEl: calBodyEl, rowSelector: '.cal-row' })
// 实测值写回宿主（宿主 `model` 依赖同一 laneLimit；跨视图保留）
watch(measuredLaneLimit, (value) => (laneLimit.value = value), { immediate: true })

// @computed 星期表头（随周起始口径：sunday 日~六 / monday 一~日）
const weekdays = computed(() => weekdaysOf(weekStart.value))

// @computed 筛选激活态（空态出口）
const hasMonthTasks = computed(() => model.value.rows.some((row) => row.segments.length > 0))
// @computed 空态（O6 统一工厂：与周视图/未安排抽屉同源；文案按视图注入）
const emptyState = computed(() =>
    buildCalendarEmptyState({
        hasTasks: hasMonthTasks.value,
        filterActive: filterActive.value,
        hideCompleted: hideCompleted.value,
        filterText: '当前筛选条件下，本月暂无任务',
        hideCompletedText: '已隐藏已完成任务，本月暂无未完成任务',
        emptyText: '本月暂无任务',
        onClearFilter: () => clearFilter(),
        onShowCompleted: () => (hideCompleted.value = false)
    })
)

// —— 动态可视轨道数：数据/视图状态就绪后再量一次（等高校换场景 RO 不触发时补量；DEF-2） ——
watch(
    [loading, error, () => emptyState.value],
    () => {
        attachBodyObserver()
        void nextTick(measureAndApplyLaneLimit)
    },
    { flush: 'post' }
)

// —— O3 每格派生数据预计算（性能：42 格 × 模板 3 次重复调用纯函数 → 每格一次；显示语义零变更） ——

/** 单个日期格派生视图（专注角标 + 溢出 +N 预计算） */
type CellView = {
    cell: CalendarRow['cells'][number]
    badge: string // 专注角标（'' = 不显示）
    overflow: CalendarOverflow | null // +N
}

/** 单行派生视图（格数据 + 可视任务条） */
type RowView = {
    row: CalendarRow
    cells: CellView[]
    segments: CalendarSegment[]
}

// @computed 网格派生视图（badgeLabel/overflowOn/visibleSegments 每格/每行一次，模板直接消费）
const rowViews = computed<RowView[]>(() =>
    model.value.rows.map((row) => ({
        row,
        cells: row.cells.map((cell) => ({
            cell,
            badge: badgeLabel(cell.dateKey),
            overflow: row.overflow.find((item) => item.dateKey === cell.dateKey) ?? null
        })),
        segments: row.segments.filter((seg) => seg.lane < laneLimit.value)
    }))
)

// @method 回车提交（dateKey 来自所在格条带；成功由 composable 清除并卸载，失败保留文本可重试）
const quickSubmit = (dateKey: string, name: string) => {
    void inlineCreateTask(dateKey, name)
}

// @method 任务条定位样式（连续条按列区间铺满；O2 共享几何纯函数）
const segStyle = segmentStyleOf

// @method 跨行续接标记：行尾（后续行继续）只在与网格内下一行相接处显示
const isRowEnd = (seg: { colEnd: number; isEnd: boolean }, row: CalendarRow): boolean =>
    row.row < GRID_ROWS - 1 && seg.colEnd === GRID_COLUMNS - 1 && !seg.isEnd

// @method 跨行续接标记：行首（承接上一行）只在与网格内上一行相接处显示
const isRowStart = (seg: { colStart: number; isStart: boolean }, row: CalendarRow): boolean =>
    row.row > 0 && seg.colStart === 0 && !seg.isStart

// @method 日期格 Enter 激活（O7 焦点管理：与点击同语义；格内交互控件/输入放行原生行为）
const onCellEnter = (event: KeyboardEvent, dateKey: string): void => {
    if (event.key !== 'Enter') return
    if (isInteractiveKeyTarget(event.target)) return
    event.stopPropagation()
    event.preventDefault()
    onOpenDay(dateKey)
}

// —— C2-F9 月视图标题年-月跳转（TASK-09：NueDropdown 触发器；O2 抽取 useMonthJump；跳转语义不变） ——
// 调用点解构为顶层 ref（模板嵌套 ref 不解包；:active="mjpOpen" / :anchor-year="year" 顶层解包，REG-01）
const {
    titleEl: mjpTitleEl,
    open: mjpOpen,
    onOpen: onMonthJumpOpen,
    onClose: onMonthJumpClose,
    onExecute: onMonthJumpExecute
} = useMonthJump({
    onSelect: (targetYear, targetMonth) => jumpToMonth(targetYear, targetMonth)
})
</script>

<template>
    <nue-div vertical class="nue-calendar-monthly" gap="0">
        <!-- 月份导航 -->
        <nue-div align="center" class="cal-header" gap="var(--nue-gap-xs)">
            <nue-div align="center" gap="2px">
                <nue-button
                    :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                    theme="icon,ghost"
                    @click="switchDisplayAside"
                />
                <nue-button
                    icon="arrow-left"
                    theme="icon,ghost"
                    title="上个月"
                    @click="goPrevMonth"
                >
                </nue-button>
                <!-- 年-月跳转 NueDropdown（TASK-09：NueDropdown 内建开合/定位/Esc/外点；
                     closeWhenExecuted 月格即点即跳即关；双视图同款） -->
                <nue-dropdown
                    placement="bottom-start"
                    size="small"
                    group="calendar-month-jump"
                    close-when-executed
                    @open="onMonthJumpOpen"
                    @close="onMonthJumpClose"
                    @execute="onMonthJumpExecute"
                >
                    <template #trigger="{ trigger }">
                        <button
                            ref="mjpTitleEl"
                            type="button"
                            class="cal-title"
                            title="跳转到年月"
                            @click="trigger"
                        >
                            {{ monthTitle }}
                        </button>
                    </template>
                    <calendar-month-grid :anchor-year="year" :active="mjpOpen" />
                </nue-dropdown>
                <nue-button
                    icon="arrow-right"
                    theme="icon,ghost"
                    title="下个月"
                    @click="goNextMonth"
                >
                </nue-button>
            </nue-div>
            <nue-div align="center" gap="var(--nue-gap-xs)">
                <calendar-sort-dropdown v-model="sort" />
                <nue-div class="cal-view-toggle" role="group" aria-label="视图切换">
                    <nue-button
                        theme="small,ghost"
                        class="cal-view-btn is-active"
                        title="当前：月视图"
                        aria-pressed="true"
                    >
                        月
                    </nue-button>
                    <nue-button
                        theme="small,ghost"
                        class="cal-view-btn"
                        title="切换周视图"
                        aria-pressed="false"
                        @click="onGoWeekView"
                    >
                        周
                    </nue-button>
                    <nue-button
                        theme="small,ghost"
                        class="cal-view-btn"
                        title="切换日视图"
                        aria-pressed="false"
                        @click="onGoDayView"
                    >
                        日
                    </nue-button>
                </nue-div>
                <span class="cal-view-sep" aria-hidden="true"></span>
                <nue-button
                    theme="ghost,small"
                    :disabled="unscheduledDisabled"
                    title="未安排任务：快速安排到某日"
                    @click="onOpenUnscheduled"
                >
                    未安排 {{ unscheduledTasks.length }}
                </nue-button>
                <nue-button theme="ghost,small" @click="goToToday">今天</nue-button>
            </nue-div>
        </nue-div>

        <!-- 星期表头 -->
        <nue-div class="cal-weekdays" gap="0">
            <div v-for="day in weekdays" :key="day" class="cal-weekday">{{ day }}</div>
        </nue-div>

        <!-- 月历主体 -->
        <div ref="calBodyEl" class="cal-body">
            <!-- 加载中 -->
            <div v-if="loading" class="cal-body-state">
                <loading-comp height="100%" />
            </div>
            <!-- 加载失败 -->
            <div v-else-if="error" class="cal-body-state">
                <nue-div vertical align="center" gap="8px">
                    <nue-text size="var(--nue-text-sm)">{{ error }}</nue-text>
                    <nue-button theme="primary,small" @click="retry">重试</nue-button>
                </nue-div>
            </div>
            <!-- 空态（筛选/隐藏完成/当月无任务） -->
            <div v-else-if="emptyState" class="cal-body-state">
                <nue-div vertical align="center" gap="8px">
                    <nue-text size="var(--nue-text-sm)" class="cal-empty-text">
                        {{ emptyState.text }}
                    </nue-text>
                    <nue-button
                        v-if="emptyState.action"
                        theme="primary,small"
                        @click="emptyState.run"
                    >
                        {{ emptyState.action }}
                    </nue-button>
                </nue-div>
            </div>
            <!-- 网格 -->
            <template v-else>
                <div v-for="rv in rowViews" :key="rv.row.row" class="cal-row" role="row">
                    <!-- 日期格（TASK-07：整格点击不再开当日面板，仅 hover 高亮；
                         O7：gridcell 语义 + 可聚焦/Enter 激活；N+ 文本为开抽屉唯一入口） -->
                    <div
                        v-for="cv in rv.cells"
                        :key="cv.cell.cell"
                        class="cal-cell"
                        role="gridcell"
                        tabindex="0"
                        :aria-selected="cv.cell.isSelected"
                        :data-cal-drop="cv.cell.dateKey"
                        :class="{
                            'cal-cell--outside': cv.cell.monthOffset !== 0,
                            'cal-cell--today': cv.cell.isToday,
                            'cal-cell--selected': cv.cell.isSelected,
                            'cal-cell--weekend': cv.cell.isWeekend,
                            'cal-cell--drop': drag.isTarget(cv.cell.dateKey)
                        }"
                        @keydown="onCellEnter($event, cv.cell.dateKey)"
                    >
                        <span class="cal-cell-top">
                            <span class="cal-date">{{ cv.cell.day }}</span>
                            <span
                                v-if="cv.badge"
                                class="cal-badge"
                                :title="`当日完成 ${cv.badge} 轮专注`"
                            >
                                {{ cv.badge }}
                            </span>
                        </span>
                        <div class="cal-band" @click.stop>
                            <template v-if="quickCreateDate === cv.cell.dateKey">
                                <quick-create
                                    :pending="quickCreatePending"
                                    @submit="(name) => quickSubmit(cv.cell.dateKey, name)"
                                    @cancel="closeQuickCreate"
                                />
                            </template>
                            <template v-else>
                                <button
                                    v-if="cv.cell.monthOffset === 0"
                                    type="button"
                                    class="cal-quick-add"
                                    title="快速新建"
                                    @click.stop="openQuickCreate(cv.cell.dateKey)"
                                >
                                    +
                                </button>
                                <button
                                    v-if="cv.overflow"
                                    type="button"
                                    class="cal-more"
                                    :title="`还有 ${cv.overflow.count} 个任务`"
                                    @click.stop="onOpenDay(cv.cell.dateKey)"
                                >
                                    +{{ cv.overflow.count }}
                                </button>
                            </template>
                        </div>
                    </div>

                    <!-- 任务条层（连续条跨格/跨行；O7：栅格行内的呈现层，不影响条 button 语义） -->
                    <div class="cal-lanes" role="presentation">
                        <task-bar
                            v-for="seg in rv.segments"
                            :key="`${seg.task.id}-${seg.colStart}`"
                            :task="seg.task"
                            :pos="segStyle(seg)"
                            :show-time="showEndTimeInMonth(seg, rv.row)"
                            :cont-start="isRowStart(seg, rv.row)"
                            :cont-end="isRowEnd(seg, rv.row)"
                            :busy="rescheduleBusyId === seg.task.id"
                            :dragging="
                                drag.session.active &&
                                drag.session.kind === 'bar' &&
                                drag.session.taskId === seg.task.id
                            "
                            @open="openTaskDetails(seg.task.id)"
                            @reschedule="(dateKey) => scheduleToDay(seg.task, dateKey)"
                            @drag-pointer-down="
                                (event) => drag.startPossible(seg.task, 'bar', event)
                            "
                        />
                    </div>
                    <!-- 网格分隔线覆盖层（TASK-07：线在任务条上方，pointer-events:none） -->
                    <div class="cal-lines" role="presentation"></div>
                </div>
            </template>
        </div>
    </nue-div>
</template>

<style scoped>
/* ── 承载层已迁至 `.nue-calendar-host`（padding/令牌/背景/溢出）；本视图仅根高度口径 ── */
.nue-calendar-monthly {
    height: 100%;
    min-height: 0;
    overflow: hidden;
}

/* ── 月份导航按钮 / 侧栏开关：TASK-16 登记的零引用死规则已于 T93 清理（模板与脚本均无引用） ── */

.cal-empty-text {
    color: var(--cal-muted);
}
</style>