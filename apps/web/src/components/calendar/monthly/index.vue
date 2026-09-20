<script setup lang="ts">
import { Loading as LoadingComp } from '@nao-todo/shared'
import { computed, inject, nextTick, provide, ref, watch } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import CalendarDayDrawer from './day-drawer.vue'
import CalendarWeekly from '../weekly/index.vue'
import QuickCreate from './quick-create.vue'
import TaskBar from './task-bar.vue'
import UnscheduledDrawer from './unscheduled-drawer.vue'
import ScheduleUndoToast from './undo-toast.vue'
import { buildCalendarEmptyState } from './empty-state'
import { showEndTimeInMonth } from './segment-time'
import { ghostPointOf, useDragSchedule } from './use-drag-schedule'
import { segmentStyleOf, useCalendarGrid } from './use-calendar-grid'
import { useMonthJump } from './use-month-jump'
import CalendarSortDropdown from './calendar-sort-dropdown.vue'
import CalendarMonthGrid from './calendar-month-grid.vue'
import { CALENDAR_KEY_SCOPE, isCalendarKeyLocked, isInteractiveKeyTarget } from './keyboard-nav'
import useCalendarMonthly from './use-calendar-monthly'
import {
    dateKeyOf,
    GRID_COLUMNS,
    GRID_ROWS,
    todayDateKey,
    weekStartKeyOf,
    weekdaysOf,
    type CalendarOverflow,
    type CalendarRow,
    type CalendarSegment
} from './monthly-layout'
import dayjs from 'dayjs'
import { usePomodoroBadge, type PomodoroBadgeRange } from './use-pomodoro-badge'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { useScope, useShortcut } from '@/hooks'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { CALENDAR_WEEKLY_CONTEXT_KEY, type CalendarWeeklyContext } from '../weekly-context'

import '../calendar-grid.css'

defineOptions({ name: 'CalendarMonthly' })

// —— O2 网格共享几何 + DEF-2 动态可视轨道数（行高实测；未测得前回退 3） ——
const calBodyEl = ref<HTMLElement | null>(null)
const {
    laneLimit,
    measure: measureAndApplyLaneLimit,
    attach: attachBodyObserver
} = useCalendarGrid({ containerEl: calBodyEl, rowSelector: '.cal-row' })

// @viewContext 应用级子侧栏开关（与任务页 header 行为一致）
const { isDisplayAside, switchDisplayAside } = inject(INDEX_VIEW_CONTEXT_KEY)!
const { pomodoroBadge } = inject(CALENDAR_VIEW_CONTEXT_KEY)!

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
    inlineCreateTask,
    // —— 排序（TASK-08：月/周共享；仅展示顺序） ——
    sort,
    sortedTasks
} = useCalendarMonthly(laneLimit)
// —— B1-F5 专注徽标（区间=当前可见格：月=网格首末格 / 周=锚点所在周；开关 off=停拉+清零） ——
const badgeRange = computed<PomodoroBadgeRange | null>(() => {
    if (!pomodoroBadge.value) return null
    if (viewMode.value === 'month') {
        if (!model.value) return null
        return { fromKey: model.value.firstKey, toKey: model.value.lastKey }
    }
    const anchor = dayjs(selectedKey.value)
    if (!selectedKey.value || !anchor.isValid()) return null
    const fromKey = weekStartKeyOf(selectedKey.value, weekStart.value)
    const toKey = dateKeyOf(dayjs(fromKey).add(6, 'day').valueOf())
    return { fromKey, toKey }
})
const { badgeLabel } = usePomodoroBadge(badgeRange, pomodoroBadge)

// @computed 星期表头（随周起始口径：sunday 日~六 / monday 一~日）
const weekdays = computed(() => weekdaysOf(weekStart.value))

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

// —— O3 每格派生数据预计算（性能：42 格 × 模板 3 次重复调用纯函数 → 每格一次；显示语义零变更） ——

/** 单个日期格派生视图（专注角标 + 溢出 +N 预计算） */
type CellView = {
    cell: CalendarRow['cells'][number]
    badge: string // 专注角标（'' = 不显示）
    overflow: CalendarOverflow | null // +N
}

/** 单行派生视图（格数据 + 可视任务条；visibleSegments 由方法改 computed，对齐 weekly） */
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

// @method 从当日面板打开任务详情
const openTaskFromPanel = (taskId: TaskViewObject['id']) => {
    openTaskDetails(taskId)
}

// @method 日期格 Enter 激活（O7 焦点管理：与点击同语义；格内交互控件/输入放行原生行为）
const onCellEnter = (event: KeyboardEvent, dateKey: string): void => {
    if (event.key !== 'Enter') return
    if (isInteractiveKeyTarget(event.target)) return
    event.stopPropagation()
    event.preventDefault()
    openDay(dateKey)
}

// @method 当日面板「本周」下钻：锚定该日并切到周视图
const showWeekOf = (dateKey: string) => {
    selectDate(dateKey)
    goToWeekView()
    dayDrawerOpen.value = false
}

// —— O14 周视图上下文 provide（weekly 组件改 inject，消除 33 个 props 穿透） ——
provide<CalendarWeeklyContext>(CALENDAR_WEEKLY_CONTEXT_KEY, {
    loading,
    error,
    onRetry: retry,
    // TASK-08：周视图展示已排序快照（与月视图同源同排序）
    tasks: sortedTasks,
    sort,
    selectedKey,
    filterActive,
    hideCompleted,
    onClearFilter: clearFilter,
    onShowCompleted: () => (hideCompleted.value = false),
    onOpenDay: openDay,
    onOpenTask: openTaskFromPanel,
    onGoMonth: goToMonthView,
    onPrevWeek: goPrevWeek,
    onNextWeek: goNextWeek,
    onGoToday: goToToday,
    unscheduledCount: computed(() => unscheduledTasks.value.length),
    unscheduledDisabled: unscheduledBtnDisabled,
    onOpenUnscheduled: () => (unscheduledOpen.value = true),
    quickCreateDate,
    quickPending: quickCreatePending,
    onQuickOpen: openQuickCreate,
    onQuickCancel: closeQuickCreate,
    onQuickSubmit: inlineCreateTask,
    weekStart,
    busyTaskId: rescheduleBusyId,
    onRescheduleTask: scheduleToDay,
    dragActive: computed(() => drag.session.active),
    dragTaskId: computed(() =>
        drag.session.active && drag.session.kind === 'bar' ? drag.session.taskId : ''
    ),
    dragHoverKey: computed(() => drag.session.hoverKey),
    onDragBar: (task, event) => drag.startPossible(task, 'bar', event),
    onJumpYearMonth: jumpToWeekOfMonthFirst,
    onBadgeLabel: badgeLabel
})

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
                <nue-div align="center">
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
                            @click="goToWeekView"
                        >
                            周
                        </nue-button>
                    </nue-div>
                    <nue-divider vertical aria-hidden="true" />
                    <nue-div gap="var(--nue-gap-xs)">
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
                                        @click.stop="openDay(cv.cell.dateKey)"
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
        </template>

        <!-- 周视图（A1；O14：状态与动作由 provide 的周视图上下文注入，无 props 穿透） -->
        <template v-else>
            <calendar-weekly />
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
/* ── 设计底座根布局（令牌本体已归并至 calendar-grid.css） ── */
.nue-calendar-monthly {
    height: 100%;
    padding: 1rem;
    background: var(--cal-bg);
    overflow: hidden;
}

/* ── 月份导航（header 共享布局见 calendar-grid.css；以下为月视图专属遗留样式） ── */
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