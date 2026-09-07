<script setup lang="ts">
import { Loading as LoadingComp } from '@nao-todo/shared'
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import CalendarDayDrawer from './day-drawer.vue'
import CalendarWeekly from '../weekly/index.vue'
import QuickCreate from './quick-create.vue'
import TaskBar from './task-bar.vue'
import UnscheduledDrawer from './unscheduled-drawer.vue'
import ScheduleUndoToast from './undo-toast.vue'
import { ghostPointOf, useDragSchedule } from './use-drag-schedule'
import MonthJumpPanel from './month-jump-panel.vue'
import { CALENDAR_KEY_SCOPE, isCalendarKeyLocked, isInteractiveKeyTarget } from './keyboard-nav'
import useCalendarMonthly from './use-calendar-monthly'
import {
    dateKeyOf,
    GRID_COLUMNS,
    GRID_ROWS,
    MAX_VISIBLE_LANES,
    todayDateKey,
    type CalendarRow
} from './monthly-layout'
import { useScope, useShortcut } from '@/hooks'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'

defineOptions({ name: 'CalendarMonthly' })

// 布局常量（与下方 scoped 样式中的数值保持一致）
const DATE_OFFSET = 26 // 日期号区域高度 + 首个任务条上间距
const ITEM_STEP = 18 // 单条任务条高度(16) + 纵向间距(2)
const BAND_HEIGHT = 24 // 格底预留条带（DEF-1：+/+N/编辑器占用，任务条区其上截断）

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
    selectedKey,
    selectDate,
    goPrevMonth,
    goNextMonth,
    goToToday,
    year,
    monthIndex,
    jumpToMonth,
    jumpToWeekOfMonthFirst,
    getDayTasks,
    toggleDone,
    deferToToday,
    scheduleToDay,
    unscheduledTasks,
    scheduleBusy,
    runBatchSchedule,
    rescheduleBusyId,
    undoAction,
    undoBusy,
    undoLast,
    dismissUndoAction,
    createTaskOnDay,
    openTaskDetails,
    // —— 筛选（空态/清除出口） ——
    selectedProjectIds,
    selectedTagIds,
    hideCompleted,
    clearFilter,
    // —— 周起始口径（C9） ——
    weekStart,
    // —— 视图态（A1 月/周） ——
    viewMode,
    goToWeekView,
    goToMonthView,
    goPrevWeek,
    goNextWeek,
    tasks,
    // —— 格内快速新建（B6） ——
    quickCreateDate,
    quickCreatePending,
    openQuickCreate,
    closeQuickCreate,
    inlineCreateTask
} = useCalendarMonthly(laneLimit)

// @computed 星期表头（随周起始口径：sunday 日~六 / monday 一~日）
const weekdays = computed(() =>
    weekStart.value === 'monday'
        ? ['一', '二', '三', '四', '五', '六', '日']
        : ['日', '一', '二', '三', '四', '五', '六']
)

// @states 当日面板
const dayDrawerDate = ref('')
const dayDrawerOpen = ref(false)
const dayTasks = computed(() => (dayDrawerDate.value ? getDayTasks(dayDrawerDate.value) : []))

// @states 未安排抽屉（B7）
const unscheduledOpen = ref(false)

// —— F1 拖拽排期会话（月/周网格为 drop 面；行源拖起激活时收起抽屉；busy 禁起；drop 走 scheduleToDay = T1 + U2 单条链路） ——
const drag = useDragSchedule({
    isBusy: () => rescheduleBusyId.value !== '' || scheduleBusy.value || undoBusy.value,
    closeUnscheduled: () => {
        unscheduledOpen.value = false
    },
    scheduleOne: scheduleToDay
})

// @method 浮空胶囊定位样式（fixed 固定跟随，非 DOM 克隆）
const ghostStyle = () => {
    const point = ghostPointOf(drag.session.x, drag.session.y)
    return { left: `${point.x}px`, top: `${point.y}px` }
}

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
    const next = Math.max(1, Math.floor((rowHeight - DATE_OFFSET - BAND_HEIGHT) / ITEM_STEP))
    if (next !== laneLimit.value) laneLimit.value = next
}
const scheduleLaneMeasure = () => {
    clearTimeout(laneResizeTimer)
    laneResizeTimer = setTimeout(measureAndApplyLaneLimit, 100)
}

// @lifecycle 观测网格容器高度（网格出现/消失、窗口缩放、月/周切换重建后重挂）
onMounted(() => {
    attachBodyObserver()
    measureAndApplyLaneLimit()
})
onUnmounted(() => {
    laneBodyObserver?.disconnect()
    laneBodyObserver = undefined
    clearTimeout(laneResizeTimer)
})

// @method 将 RO 挂到当前 .cal-body（v-if 重建后需要重新 observe）
const attachBodyObserver = () => {
    laneBodyObserver?.disconnect()
    const el = calBodyEl.value
    if (!el) return
    laneBodyObserver = new ResizeObserver(scheduleLaneMeasure)
    laneBodyObserver.observe(el)
}

// @watch 数据/视图状态就绪后再量一次（等高校换场景 RO 不触发时补量）
watch(
    [loading, error, () => emptyState.value, () => viewMode.value],
    () => {
        attachBodyObserver()
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

// @method 回车提交（dateKey 来自所在格条带；成功由 composable 清除并卸载，失败保留文本可重试）
const quickSubmit = (dateKey: string, name: string) => {
    void inlineCreateTask(dateKey, name)
}

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

// @method 段首是否显示开始时刻：仅真起始段且首格即 startAt 当日（跨行续接/裁剪可见段不显示）
const segShowTime = (
    seg: { task: TaskViewObject; isStart: boolean; colStart: number },
    row: CalendarRow
): boolean => {
    const task = seg.task
    return (
        !!seg.isStart &&
        !!task.startAt &&
        row.cells[seg.colStart]?.dateKey === dateKeyOf(task.startAt)
    )
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

// @method 当日面板「本周」下钻：锚定该日并切到周视图
const showWeekOf = (dateKey: string) => {
    selectDate(dateKey)
    goToWeekView()
    dayDrawerOpen.value = false
}

// —— C2-F9 月视图标题年-月跳转（面板弹层；再点标题 toggle 收起；关闭归还焦点） ——
const mjpOpen = ref(false)
const mjpPos = ref({ x: 0, y: 0 })
const mjpTitleEl = ref<HTMLElement | null>(null)

const closeMonthJump = (): void => {
    mjpOpen.value = false
    void nextTick(() => mjpTitleEl.value?.focus())
}
const toggleMonthJump = (event: MouseEvent): void => {
    if (mjpOpen.value) {
        closeMonthJump()
        return
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    mjpPos.value = {
        x: Math.min(Math.max(4, rect.left), window.innerWidth - 248),
        y: Math.min(Math.max(4, rect.bottom + 4), window.innerHeight - 260)
    }
    mjpOpen.value = true
}
const onMonthJumpSelect = (targetYear: number, targetMonth: number): void => {
    jumpToMonth(targetYear, targetMonth)
    closeMonthJump()
}

// —— C1-F8 键盘导航（calendar scope 激活窗口 = 组件挂载期，卸载即失效）——
// 键位与既有控件按钮同一出口（goPrev/NextMonth、goPrev/NextWeek、goToToday、视图切换、
// openDay、openQuickCreate）；弹层集合开启（F4 菜单/日期面板/当日面板/未安排抽屉/任务详情/对话框）
// 一律抑制（PM Q1/Q2；undo-toast/NueMessage 轻提示除外）；小写裸键、修饰键严格匹配由引擎保证。
useScope(CALENDAR_KEY_SCOPE)
const calendarKeyLocked = (): boolean => isCalendarKeyLocked(document)
const guardNav = (action: () => void) => (): void => {
    if (calendarKeyLocked()) return
    action()
}
const NAV_GROUP = '日历'
useShortcut(
    'calendar.nav.prev',
    'arrowleft',
    guardNav(() => (viewMode.value === 'month' ? goPrevMonth() : goPrevWeek())),
    { scope: CALENDAR_KEY_SCOPE, label: '上个月/上周', group: NAV_GROUP, preventDefault: true }
)
useShortcut(
    'calendar.nav.next',
    'arrowright',
    guardNav(() => (viewMode.value === 'month' ? goNextMonth() : goNextWeek())),
    { scope: CALENDAR_KEY_SCOPE, label: '下个月/下周', group: NAV_GROUP, preventDefault: true }
)
useShortcut(
    'calendar.nav.today',
    't',
    guardNav(() => goToToday()),
    { scope: CALENDAR_KEY_SCOPE, label: '回到今天', group: NAV_GROUP }
)
useShortcut(
    'calendar.nav.week',
    'w',
    guardNav(() => goToWeekView()),
    { scope: CALENDAR_KEY_SCOPE, label: '切到周视图', group: NAV_GROUP }
)
useShortcut(
    'calendar.nav.month',
    'm',
    guardNav(() => goToMonthView()),
    { scope: CALENDAR_KEY_SCOPE, label: '切到月视图', group: NAV_GROUP }
)
// 格内快速新建（遮蔽 index-view 全局新建任务 n；离开日历后 n 恢复全局——scope 卸载即解蔽）
useShortcut(
    'calendar.quick-create',
    'n',
    guardNav(() => openQuickCreate(selectedKey.value || todayDateKey())),
    { scope: CALENDAR_KEY_SCOPE, label: '在选中日快速新建', group: NAV_GROUP }
)
// 打开当日面板（PM Q6/te v1.1）：目标为可聚焦交互控件时放行原生激活（不拦截、不开面板）
useShortcut('calendar.open-day', 'enter', () => openDay(selectedKey.value || todayDateKey()), {
    scope: CALENDAR_KEY_SCOPE,
    label: '打开当日面板',
    group: NAV_GROUP,
    preventDefault: true,
    available: (context) => !calendarKeyLocked() && !isInteractiveKeyTarget(context.event?.target)
})
</script>

<template>
    <nue-div vertical class="nue-calendar-monthly" gap="0">
        <!-- 月视图（默认） -->
        <template v-if="viewMode === 'month'">
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
                    <button
                        ref="mjpTitleEl"
                        type="button"
                        class="cal-title"
                        data-mjp-trigger
                        title="跳转到年月"
                        @click="toggleMonthJump"
                    >
                        {{ monthTitle }}
                    </button>
                    <nue-button
                        icon="arrow-right"
                        theme="icon,ghost"
                        title="下个月"
                        @click="goNextMonth"
                    >
                    </nue-button>
                </nue-div>
                <!-- 年-月跳转面板（C2-F9） -->
                <month-jump-panel
                    :open="mjpOpen"
                    :x="mjpPos.x"
                    :y="mjpPos.y"
                    :anchor-year="year"
                    :anchor-month="monthIndex + 1"
                    @select="onMonthJumpSelect"
                    @close="closeMonthJump"
                />
                <nue-div align="center" gap="6px">
                    <nue-div class="cal-view-toggle" role="group" aria-label="视图切换">
                        <nue-button
                            theme="small,ghost"
                            class="cal-view-btn is-active"
                            title="当前：月视图"
                        >
                            月
                        </nue-button>
                        <nue-button
                            theme="small,ghost"
                            class="cal-view-btn"
                            title="切换周视图"
                            @click="goToWeekView"
                        >
                            周
                        </nue-button>
                    </nue-div>
                    <span class="cal-view-sep" aria-hidden="true"></span>
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
                            :data-cal-drop="cell.dateKey"
                            :class="{
                                'cal-cell--outside': cell.monthOffset !== 0,
                                'cal-cell--today': cell.isToday,
                                'cal-cell--selected': cell.isSelected,
                                'cal-cell--weekend': cell.isWeekend,
                                'cal-cell--edge': cell.cell % 7 === 6,
                                'cal-cell--drop': drag.isTarget(cell.dateKey)
                            }"
                            @click="openDay(cell.dateKey)"
                        >
                            <span class="cal-date">{{ cell.day }}</span>
                            <div class="cal-band" @click.stop>
                                <template v-if="quickCreateDate === cell.dateKey">
                                    <quick-create
                                        :pending="quickCreatePending"
                                        @submit="(name) => quickSubmit(cell.dateKey, name)"
                                        @cancel="closeQuickCreate"
                                    />
                                </template>
                                <template v-else>
                                    <button
                                        v-if="cell.monthOffset === 0"
                                        type="button"
                                        class="cal-quick-add"
                                        title="快速新建"
                                        @click.stop="openQuickCreate(cell.dateKey)"
                                    >
                                        +
                                    </button>
                                    <button
                                        v-if="overflowOn(row, cell.dateKey)"
                                        type="button"
                                        class="cal-more"
                                        :title="`还有 ${overflowOn(row, cell.dateKey)!.count} 个任务`"
                                        @click.stop="openDay(cell.dateKey)"
                                    >
                                        +{{ overflowOn(row, cell.dateKey)!.count }}
                                    </button>
                                </template>
                            </div>
                        </div>

                        <!-- 任务条层（连续条跨格/跨行） -->
                        <div class="cal-lanes">
                            <task-bar
                                v-for="seg in visibleSegments(row)"
                                :key="`${seg.task.id}-${seg.colStart}`"
                                :task="seg.task"
                                :pos="segStyle(seg)"
                                :show-time="segShowTime(seg, row)"
                                :cont-start="isRowStart(seg, row)"
                                :cont-end="isRowEnd(seg, row)"
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
                    </div>
                </template>
            </div>
        </template>

        <!-- 周视图（A1） -->
        <template v-else>
            <calendar-weekly
                :loading="loading"
                :error="error"
                :on-retry="retry"
                :tasks="tasks"
                :selected-key="selectedKey"
                :filter-active="filterActive"
                :hide-completed="hideCompleted"
                :on-clear-filter="clearFilter"
                :on-show-completed="() => (hideCompleted = false)"
                :on-open-day="openDay"
                :on-open-task="openTaskFromPanel"
                :on-go-month="goToMonthView"
                :on-prev-week="goPrevWeek"
                :on-next-week="goNextWeek"
                :on-go-today="goToToday"
                :unscheduled-count="unscheduledTasks.length"
                :unscheduled-disabled="unscheduledBtnDisabled"
                :on-open-unscheduled="() => (unscheduledOpen = true)"
                :quick-create-date="quickCreateDate"
                :quick-pending="quickCreatePending"
                :on-quick-open="openQuickCreate"
                :on-quick-cancel="closeQuickCreate"
                :on-quick-submit="inlineCreateTask"
                :busy-task-id="rescheduleBusyId"
                :on-reschedule-task="scheduleToDay"
                :drag-active="drag.session.active"
                :drag-task-id="
                    drag.session.active && drag.session.kind === 'bar' ? drag.session.taskId : ''
                "
                :drag-hover-key="drag.session.hoverKey"
                :on-drag-bar="(task, event) => drag.startPossible(task, 'bar', event)"
                :on-jump-year-month="(year, month) => jumpToWeekOfMonthFirst(year, month)"
                :week-start="weekStart"
            />
        </template>

        <!-- 当日任务面板 -->
        <calendar-day-drawer
            v-model:open="dayDrawerOpen"
            :date-key="dayDrawerDate"
            :tasks="dayTasks"
            :on-toggle-done="toggleDone"
            :on-defer="deferToToday"
            :on-open-task="openTaskFromPanel"
            :on-create="() => createTaskOnDay(dayDrawerDate)"
            :on-go-week="showWeekOf"
        />

        <!-- 未安排任务抽屉（B7 + F3 多选批量 / U2 撤销接线） -->
        <unscheduled-drawer
            v-model:open="unscheduledOpen"
            :tasks="unscheduledTasks"
            :filter-active="filterActive"
            :hide-completed="hideCompleted"
            :schedule-busy="scheduleBusy"
            :busy-task-id="rescheduleBusyId"
            :on-toggle-done="toggleDone"
            :on-schedule-to-day="scheduleToDay"
            :on-batch-schedule-to-day="runBatchSchedule"
            :on-row-drag-start="(task, event) => drag.startPossible(task, 'row', event)"
            :on-open-task="openTaskFromPanel"
            :on-clear-filter="clearFilter"
            :on-show-completed="() => (hideCompleted = false)"
        />

        <!-- U2 撤销 action-toast（NueMessage 无 action 按钮，自建轻量载体） -->
        <schedule-undo-toast
            v-if="undoAction"
            :action="undoAction"
            :busy="undoBusy || scheduleBusy"
            @undo="undoLast"
            @dismiss="dismissUndoAction"
        />

        <!-- F1 浮空胶囊（拖拽跟随，fixed 非 DOM 克隆） -->
        <teleport to="body">
            <div v-if="drag.session.active" class="drag-ghost" :style="ghostStyle()">
                {{ drag.session.name }}
            </div>
        </teleport>
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

/* 月标题（C2-F9：可点按钮语义，可聚焦/hover 可达；文本样式与旧 h2 一致） */
.cal-title {
    min-width: 132px;
    text-align: center;
    letter-spacing: 0.02em;
    margin: 0;
    padding: 2px 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--cal-fg);
    font-family: inherit;
    font-size: var(--nue-text-df);
    font-weight: 600;
    line-height: inherit;
    cursor: pointer;
    transition: background 60ms;
}
.cal-title:hover {
    background: var(--cal-hover);
}
.cal-title:focus-visible {
    outline: 1px solid var(--cal-border);
}

/* 月/周视图切换（分段按钮） */
/* 月/周视图切换（分段按钮：零间隙贴合） */
.cal-view-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0;
    border: 1px solid var(--cal-border);
    border-radius: var(--nue-primary-radius);
    overflow: hidden;
}
.cal-view-btn {
    border-radius: 0 !important;
}
.cal-view-btn.is-active {
    background: var(--cal-select-bg);
    color: var(--cal-fg);
    font-weight: 600;
}

/* 切换区与右侧控件之间的垂直分割线 */
.cal-view-sep {
    align-self: center;
    width: 1px;
    height: 16px;
    margin: 0 4px;
    background: var(--cal-border);
    flex: none;
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
/* F1 drop 目标高亮（含补位灰格/过去日期格，整格指示） */
.cal-cell--drop {
    background: color-mix(in srgb, var(--nue-success-color-60) 14%, var(--cal-bg));
    box-shadow: inset 0 0 0 2px var(--nue-success-color-60);
}
.cal-cell--drop .cal-date {
    border-color: var(--nue-success-color-60);
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
/* 任务条视觉（色条/色痕/时刻/续接圆点/周裁剪圆角）已抽至 ./task-bar.vue；--cal-* 令牌由本根定义 */
/* 格底预留条带（DEF-1：任务条渲染区在其上截断；+/+N/编辑器占用区） */
.cal-band {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 24px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 6px;
    box-sizing: border-box;
}
/* 悬停快速新建 +（左下；补位格无按钮由 v-if 控制） */
.cal-quick-add {
    flex: none;
    width: 18px;
    height: 16px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: var(--cal-chip-bg-hover);
    color: var(--cal-fg);
    font-size: 0.9375rem;
    line-height: 16px;
    cursor: pointer;
    opacity: 0;
    transition:
        opacity 60ms,
        background 60ms;
}
.cal-cell:hover .cal-quick-add {
    opacity: 1;
}
.cal-quick-add:hover {
    background: var(--cal-select-bg);
}

/* ── 溢出 +N（右下） ── */
.cal-more {
    flex: none;
    margin-left: auto;
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

/* F1 浮空胶囊（拖拽跟随；fixed 顶层，非 DOM 克隆；teleport body 用全局主题令牌） */
.drag-ghost {
    position: fixed;
    z-index: 1300;
    pointer-events: none;
    max-width: 220px;
    padding: 3px 10px;
    border-radius: 6px;
    background: var(--nue-primary-color-200);
    color: var(--nue-primary-text-color);
    font-size: 0.75rem;
    line-height: 1.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: 0 4px 14px color-mix(in srgb, var(--nue-primary-text-color) 20%, transparent);
    border: 1px solid var(--nue-border-color);
    box-sizing: border-box;
}
</style>