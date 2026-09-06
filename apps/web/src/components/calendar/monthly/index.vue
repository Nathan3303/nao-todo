<script setup lang="ts">
import { Loading as LoadingComp } from '@nao-todo/shared'
import dayjs from 'dayjs'
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import CalendarDayDrawer from './day-drawer.vue'
import UnscheduledDrawer from './unscheduled-drawer.vue'
import useCalendarMonthly, { isTaskOverdue } from './use-calendar-monthly'
import { GRID_COLUMNS, GRID_ROWS, MAX_VISIBLE_LANES, type CalendarRow } from './monthly-layout'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'

defineOptions({ name: 'CalendarMonthly' })

// 布局常量（与下方 scoped 样式中的数值保持一致）
const DATE_OFFSET = 26 // 日期号区域高度 + 首个任务条上间距
const ITEM_STEP = 18 // 单条任务条高度(16) + 纵向间距(2)

// @viewContext 应用级子侧栏开关（与任务页 header 行为一致）
const { isDisplayAside, switchDisplayAside } = inject(INDEX_VIEW_CONTEXT_KEY)!

// @states 动态可视轨道数（DEF-2：由行高实测决定；未测得前回退 3）
const laneLimit = ref<number>(MAX_VISIBLE_LANES)

// @viewLogic 月历视图逻辑
const {
    loading,
    error,
    retry,
    model,
    monthTitle,
    selectDate,
    goPrevMonth,
    goNextMonth,
    goToToday,
    getDayTasks,
    toggleDone,
    deferToToday,
    scheduleToDay,
    unscheduledTasks,
    createTaskOnDay,
    openTaskDetails,
    // —— 筛选（空态/清除出口） ——
    selectedProjectIds,
    selectedTagIds,
    hideCompleted,
    clearFilter
} = useCalendarMonthly(laneLimit)

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

// @states 当日面板
const dayDrawerDate = ref('')
const dayDrawerOpen = ref(false)
const dayTasks = computed(() => (dayDrawerDate.value ? getDayTasks(dayDrawerDate.value) : []))

// @states 未安排抽屉（B7）
const unscheduledOpen = ref(false)

// @computed 筛选激活态（空态出口）
const filterActive = computed(
    () => selectedProjectIds.value.length > 0 || selectedTagIds.value.length > 0
)

// @computed 未安排按钮灰态：仅真无（N=0 且非筛选/隐藏完成所致）时禁用；筛选导致时保留入口看空态出口
const unscheduledBtnDisabled = computed(
    () => unscheduledTasks.value.length === 0 && !filterActive.value && !hideCompleted.value
)
const hasMonthTasks = computed(() => model.value.rows.some((row) => row.segments.length > 0))
const emptyState = computed(() => {
    // 本月有可见任务：直接渲染网格（筛选/隐藏已完成只是收敛数据，不触发空态）
    if (hasMonthTasks.value) return null
    if (filterActive.value) {
        return {
            text: '当前筛选条件下，本月暂无任务',
            action: '清除筛选',
            run: () => clearFilter()
        }
    }
    if (hideCompleted.value) {
        return {
            text: '已隐藏已完成任务，本月暂无未完成任务',
            action: '显示已完成',
            run: () => (hideCompleted.value = false)
        }
    }
    return { text: '本月暂无任务', action: '', run: () => {} }
})

// —— 动态可视轨道数：ResizeObserver + 100ms 防抖，随行高实时调整（DEF-2） ——
const calBodyEl = ref<HTMLElement | null>(null)
let laneResizeTimer: ReturnType<typeof setTimeout> | undefined
let laneBodyObserver: ResizeObserver | undefined

// @method 按行实际高度计算可视条数：max(1, floor((行高 − 日期区26 − 底部留白4) / 18))
const measureAndApplyLaneLimit = () => {
    const firstRow = calBodyEl.value?.querySelector<HTMLElement>('.cal-row')
    const rowHeight = firstRow?.clientHeight ?? 0
    if (rowHeight <= 0) return
    const next = Math.max(1, Math.floor((rowHeight - DATE_OFFSET - 4) / ITEM_STEP))
    if (next !== laneLimit.value) laneLimit.value = next
}
const scheduleLaneMeasure = () => {
    clearTimeout(laneResizeTimer)
    laneResizeTimer = setTimeout(measureAndApplyLaneLimit, 100)
}

// @lifecycle 观测网格容器高度（网格出现/消失、窗口缩放等）
onMounted(() => {
    laneBodyObserver = new ResizeObserver(scheduleLaneMeasure)
    if (calBodyEl.value) laneBodyObserver.observe(calBodyEl.value)
    measureAndApplyLaneLimit()
})
onUnmounted(() => {
    laneBodyObserver?.disconnect()
    laneBodyObserver = undefined
    clearTimeout(laneResizeTimer)
})

// @watch 数据/视图状态就绪后再量一次（等高校换场景 RO 不触发时补量）
watch(
    [loading, error, () => emptyState.value],
    () => {
        void nextTick(measureAndApplyLaneLimit)
    },
    { flush: 'post' }
)

// @method 打开某日面板（同时选中该日）
const openDay = (dateKey: string) => {
    selectDate(dateKey)
    dayDrawerDate.value = dateKey
    dayDrawerOpen.value = true
}

// @method 可视轨道内的任务条（随动态 laneLimit 实时增减）
const visibleSegments = (row: CalendarRow) =>
    row.segments.filter((seg) => seg.lane < laneLimit.value)

// @method 某格溢出 +N
const overflowOn = (row: CalendarRow, dateKey: string) =>
    row.overflow.find((item) => item.dateKey === dateKey)

// @method 任务条定位样式（连续条按列区间铺满）
const segStyle = (seg: { colStart: number; colEnd: number; lane: number }) => {
    const left = (seg.colStart / GRID_COLUMNS) * 100
    const width = ((seg.colEnd - seg.colStart + 1) / GRID_COLUMNS) * 100
    return {
        left: `${left}%`,
        width: `${width}%`,
        top: `${DATE_OFFSET + seg.lane * ITEM_STEP}px`
    }
}

// @method 条左缘色：逾期红 > 优先级色（high=error 红 / medium=warning 琥珀 / low 中性无条）
const taskBarColor = (task: TaskViewObject): string => {
    if (isTaskOverdue(task)) return 'var(--nue-error-color-60)'
    if (task.priority === 'high') return 'var(--nue-error-color-60)'
    if (task.priority === 'medium') return 'var(--nue-warning-color-60)'
    return 'transparent'
}

// @method 段首时刻文本：仅真起始段（HH:mm）；跨行续接段/被网格裁剪的可见段不显示，避免误导
const segTimeText = (
    seg: { task: TaskViewObject; isStart: boolean; colStart: number },
    row: CalendarRow
): string => {
    const task = seg.task
    if (!seg.isStart || !task.startAt) return ''
    const start = dayjs(task.startAt)
    if (!start.isValid()) return ''
    const firstCellKey = row.cells[seg.colStart]?.dateKey
    if (start.format('YYYY-MM-DD') !== firstCellKey) return ''
    return start.format('HH:mm')
}

// @method 跨行续接标记：行尾（后续行继续）只在与网格内下一行相接处显示
const isRowEnd = (seg: { colEnd: number; isEnd: boolean }, row: CalendarRow): boolean =>
    row.row < GRID_ROWS - 1 && seg.colEnd === GRID_COLUMNS - 1 && !seg.isEnd

// @method 跨行续接标记：行首（承接上一行）只在与网格内上一行相接处显示
const isRowStart = (seg: { colStart: number; isStart: boolean }, row: CalendarRow): boolean =>
    row.row > 0 && seg.colStart === 0 && !seg.isStart

// @method 从当日面板打开任务详情
const openTaskFromPanel = (taskId: TaskViewObject['id']) => {
    openTaskDetails(taskId)
}
</script>

<template>
    <nue-div vertical class="nue-calendar-monthly" gap="0">
        <!-- 月份导航 -->
        <nue-div align="center" class="cal-header" gap="8px">
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
                <nue-text tag="h2" size="var(--nue-text-df)" :weight="600" class="cal-title">
                    {{ monthTitle }}
                </nue-text>
                <nue-button
                    icon="arrow-right"
                    theme="icon,ghost"
                    title="下个月"
                    @click="goNextMonth"
                >
                </nue-button>
            </nue-div>
            <nue-div align="center" gap="6px">
                <nue-button
                    theme="ghost,small"
                    :disabled="unscheduledBtnDisabled"
                    title="未安排任务：快速安排到某日"
                    @click="unscheduledOpen = true"
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
                <div v-for="row in model.rows" :key="row.row" class="cal-row">
                    <!-- 日期格（点击选中并打开当日面板） -->
                    <div
                        v-for="cell in row.cells"
                        :key="cell.cell"
                        class="cal-cell"
                        :class="{
                            'cal-cell--outside': cell.monthOffset !== 0,
                            'cal-cell--today': cell.isToday,
                            'cal-cell--selected': cell.isSelected,
                            'cal-cell--weekend': cell.isWeekend,
                            'cal-cell--edge': cell.cell % 7 === 6
                        }"
                        @click="openDay(cell.dateKey)"
                    >
                        <span class="cal-date">{{ cell.day }}</span>
                        <button
                            v-if="overflowOn(row, cell.dateKey)"
                            type="button"
                            class="cal-more"
                            :title="`还有 ${overflowOn(row, cell.dateKey)!.count} 个任务`"
                            @click.stop="openDay(cell.dateKey)"
                        >
                            +{{ overflowOn(row, cell.dateKey)!.count }}
                        </button>
                    </div>

                    <!-- 任务条层（连续条跨格/跨行） -->
                    <div class="cal-lanes">
                        <div
                            v-for="seg in visibleSegments(row)"
                            :key="`${seg.task.id}-${seg.colStart}`"
                            class="cal-item"
                            :class="{
                                'is-done': seg.task.state === 'done',
                                'is-overdue': isTaskOverdue(seg.task),
                                'is-start': seg.isStart,
                                'is-end': seg.isEnd,
                                'has-cont-start': isRowStart(seg, row),
                                'has-cont-end': isRowEnd(seg, row)
                            }"
                            :style="[segStyle(seg), { '--cal-pri': taskBarColor(seg.task) }]"
                            :title="seg.task.name"
                            @click.stop="openTaskDetails(seg.task.id)"
                        >
                            <span v-if="segTimeText(seg, row)" class="cal-item-time">
                                {{ segTimeText(seg, row) }}
                            </span>
                            <span
                                v-if="isRowStart(seg, row)"
                                class="cal-cont cal-cont--start"
                                title="承接上一周"
                            ></span>
                            <span
                                v-if="isRowEnd(seg, row)"
                                class="cal-cont cal-cont--end"
                                title="续至下一周"
                            ></span>
                            <span class="cal-item-text">{{ seg.task.name }}</span>
                        </div>
                    </div>
                </div>
            </template>
        </div>

        <!-- 当日任务面板 -->
        <calendar-day-drawer
            v-model:open="dayDrawerOpen"
            :date-key="dayDrawerDate"
            :tasks="dayTasks"
            :on-toggle-done="toggleDone"
            :on-defer="deferToToday"
            :on-open-task="openTaskFromPanel"
            :on-create="() => createTaskOnDay(dayDrawerDate)"
        />

        <!-- 未安排任务抽屉（B7） -->
        <unscheduled-drawer
            v-model:open="unscheduledOpen"
            :tasks="unscheduledTasks"
            :filter-active="filterActive"
            :hide-completed="hideCompleted"
            :on-toggle-done="toggleDone"
            :on-schedule-to-day="scheduleToDay"
            :on-open-task="openTaskFromPanel"
            :on-clear-filter="clearFilter"
            :on-show-completed="() => (hideCompleted = false)"
        />
    </nue-div>
</template>

<style scoped>
/* ── 设计底座（沿用既有 NueUI 黑白灰令牌） ── */
.nue-calendar-monthly {
    --cal-bg: var(--nue-primary-color-0);
    --cal-fg: var(--nue-primary-text-color);
    --cal-muted: color-mix(in srgb, var(--nue-primary-text-color) 45%, var(--nue-primary-color-0));
    --cal-border: var(--nue-border-color);
    --cal-hover: color-mix(in srgb, var(--nue-primary-text-color) 5%, var(--nue-primary-color-0));
    --cal-select-bg: color-mix(
        in srgb,
        var(--nue-primary-text-color) 9%,
        var(--nue-primary-color-0)
    );
    --cal-chip-bg: color-mix(in srgb, var(--nue-primary-text-color) 6%, var(--nue-primary-color-0));
    --cal-chip-bg-hover: color-mix(
        in srgb,
        var(--nue-primary-text-color) 18%,
        var(--nue-primary-color-0)
    );
    --cal-chip-done-bg: color-mix(
        in srgb,
        var(--nue-primary-text-color) 6%,
        var(--nue-primary-color-0)
    );
    --cal-chip-done-fg: color-mix(
        in srgb,
        var(--nue-primary-text-color) 38%,
        var(--nue-primary-color-0)
    );

    height: 100%;
    padding: 1.5rem 1.75rem 1.25rem;
    background: var(--cal-bg);
    overflow: hidden;
}

/* ── 月份导航 ── */
.cal-header {
    margin-bottom: 1rem;
    user-select: none;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.cal-nav-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--cal-fg);
    cursor: pointer;
    transition:
        background 60ms,
        border-color 60ms;
}
.cal-nav-btn:hover {
    background: var(--cal-hover);
    border-color: var(--cal-border);
}
.cal-nav-btn:active {
    background: var(--cal-border);
}

.cal-aside-toggle {
    margin-right: 4px;
}

.cal-empty-text {
    color: var(--cal-muted);
}

.cal-title {
    min-width: 132px;
    text-align: center;
    letter-spacing: 0.02em;
    margin: 0;
}

/* ── 星期表头 ── */
.cal-weekdays {
    display: flex;
    margin-bottom: 4px;
}
.cal-weekday {
    flex: 1;
    text-align: center;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--cal-muted);
    padding: 0.25rem 0;
    letter-spacing: 0.04em;
}

/* ── 网格主体 ── */
.cal-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--cal-border);
    border-radius: var(--nue-primary-radius);
    overflow: hidden;
    background: var(--cal-bg);
}

.cal-body-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
}

/* ── 行：内部 7 等分 + 独立任务条层 ── */
.cal-row {
    position: relative;
    flex: 1;
    min-height: 80px;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    overflow: hidden;
    border-top: 1px solid var(--nue-divider-color);
}
.cal-row:first-child {
    border-top: none;
}

/* 格内竖分隔线用 inset 阴影实现，不挤占列宽，保证任务条百分比定位精确 */
.cal-cell {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3px 2px 2px;
    background: var(--cal-bg);
    cursor: pointer;
    box-shadow: inset -1px 0 0 var(--cal-border);
    transition: background 50ms;
}
.cal-cell--edge {
    box-shadow: none;
}
.cal-cell:hover {
    background: var(--cal-hover);
    z-index: 0;
}
.cal-cell--outside {
    background: color-mix(in srgb, var(--cal-bg) 92%, var(--cal-border));
}

/* 今日/选中日期号 */
.cal-date {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 20px;
    font-size: 0.8125rem;
    font-weight: 450;
    line-height: 20px;
    color: var(--cal-fg);
    border: 1px solid transparent;
    border-radius: 10px;
    user-select: none;
    box-sizing: border-box;
}
.cal-cell--today .cal-date {
    border-color: var(--cal-fg);
    font-weight: 600;
}
.cal-cell--selected {
    background: var(--cal-select-bg);
}
.cal-cell--selected .cal-date {
    background: var(--cal-fg);
    color: var(--cal-bg);
    font-weight: 600;
    border-color: var(--cal-fg);
}
.cal-cell--outside .cal-date {
    color: var(--cal-muted);
}
.cal-cell--weekend:not(.cal-cell--selected) .cal-date {
    opacity: 0.72;
}

/* ── 任务条 ── */
.cal-lanes {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
.cal-item {
    position: absolute;
    height: 16px;
    display: flex;
    align-items: center;
    padding: 0 8px;
    background: var(--cal-chip-bg);
    color: var(--cal-fg);
    font-size: 0.75rem;
    line-height: 16px;
    white-space: nowrap;
    overflow: hidden;
    cursor: pointer;
    pointer-events: auto;
    transition: background 60ms;
    box-sizing: border-box;
}
/* .cal-item.is-start {
    border-top-left-radius: var(--nue-primary-radius);
    border-bottom-left-radius: var(--nue-primary-radius);
}
.cal-item.is-end {
    border-top-right-radius: var(--nue-primary-radius);
    border-bottom-right-radius: var(--nue-primary-radius);
} */
.cal-item:hover {
    background: var(--cal-chip-bg-hover);
}
.cal-item.is-done {
    background: var(--cal-chip-done-bg);
    color: var(--cal-chip-done-fg);
    text-decoration: line-through;
}
.cal-item.is-done:hover {
    background: var(--cal-chip-bg-hover);
}

.cal-item-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 2px;
}

/* 左缘色条：优先级色（逾期红覆盖），done 弱化至 ~30% 原色痕 */
.cal-item::before {
    content: '';
    position: absolute;
    left: 0;
    top: 1px;
    bottom: 1px;
    width: 2px;
    border-radius: 1px;
    background: var(--cal-pri, transparent);
    pointer-events: none;
}
.cal-item.is-done::before {
    opacity: 0.3;
}

/* 段首时刻文本（HH:mm，随条超宽省略） */
.cal-item-time {
    flex: none;
    margin-right: 6px;
    color: var(--cal-muted);
    font-size: 0.6875rem;
    line-height: 16px;
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    white-space: nowrap;
}

/* 跨行续接圆点（承接上一周 / 续至下一周） */
.cal-cont {
    position: absolute;
    top: 50%;
    width: 5px;
    height: 5px;
    margin-top: -2.5px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--cal-fg) 58%, var(--cal-bg));
    pointer-events: none;
}
.cal-cont--start {
    left: 3px;
}
.cal-cont--end {
    right: 3px;
}

/* 有续接标记的条体：为圆点预留文本间距（名称 ellipsis 不压圆点） */
.cal-item.has-cont-start {
    padding-left: 14px;
}
.cal-item.has-cont-end {
    padding-right: 14px;
}

/* ── 溢出 +N ── */
.cal-more {
    position: absolute;
    right: 4px;
    bottom: 2px;
    padding: 1px 6px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--cal-muted);
    font-size: 0.6875rem;
    line-height: 1.4;
    cursor: pointer;
    transition: background 60ms;
}
.cal-more:hover {
    background: var(--cal-hover);
    color: var(--cal-fg);
}
</style>