import { computed, inject, provide, ref, shallowRef, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import type { TaskViewObject } from '@nao-todo/domain-task'
import useCalendarMonthly from './monthly/use-calendar-monthly'
import { useDragSchedule } from './monthly/use-drag-schedule'
import { usePomodoroBadge, type PomodoroBadgeRange } from './monthly/use-pomodoro-badge'
import {
    dateKeyOf,
    MAX_VISIBLE_LANES,
    todayDateKey,
    weekStartKeyOf
} from './monthly/monthly-layout'
import {
    CALENDAR_KEY_SCOPE,
    isCalendarKeyLocked,
    isInteractiveKeyTarget
} from './monthly/keyboard-nav'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { useScope, useShortcut } from '@/hooks'
import { CALENDAR_WEEKLY_CONTEXT_KEY, type CalendarWeeklyContext } from './weekly-context'
import { CALENDAR_DAY_CONTEXT_KEY, type CalendarDayContext } from './daily/context'
import { CALENDAR_MONTHLY_CONTEXT_KEY, type CalendarMonthlyContext } from './monthly-context'
import { CALENDAR_UNDO_SINK_KEY, type CalendarUndoPayload } from './undo-sink'

export type CalendarViewMode = 'month' | 'week' | 'day'

/** 视图切换导航（宿主由 route.name 派生 + router.replace；standalone 由内部态兜底） */
export type CalendarViewNavigation = {
    viewMode: Ref<CalendarViewMode>
    toMonth: () => void
    toWeek: () => void
    toDay: () => void
}

/**
 * useCalendarHost —— 日历状态宿主（C1 结果态唯一）
 * @description 单一宿主组装 `useCalendarMonthly`（任务快照/锚点/排序/抽屉/撤销/偏好）、
 *              唯一拖拽会话、专注角标、键盘快捷键，并 provide 三份视图上下文 + 撤销上报通道。
 *              由 `views/index/calendar/host.vue`（应用路由宿主）与
 *              `components/calendar/monthly/standalone.vue`（无宿主单测兜底）复用。
 * @param options.laneLimit 网格实测可视轨道数（月视图写回；缺省内部创建）
 * @param options.view 视图导航（缺省内部 `viewMode` 态，standalone 用）
 */
export const useCalendarHost = (options?: {
    laneLimit?: Ref<number>
    view?: CalendarViewNavigation
}) => {
    const laneLimit = options?.laneLimit ?? ref<number>(MAX_VISIBLE_LANES)

    // @states 视图导航：宿主传入 route 派生态（应用）；缺省用内部态（standalone 兜底，非镜像）
    const fallbackViewMode = ref<CalendarViewMode>('month')
    const viewMode = options?.view?.viewMode ?? fallbackViewMode
    const toMonth = options?.view?.toMonth ?? (() => (fallbackViewMode.value = 'month'))
    const toWeek = options?.view?.toWeek ?? (() => (fallbackViewMode.value = 'week'))
    const toDay = options?.view?.toDay ?? (() => (fallbackViewMode.value = 'day'))

    // @viewLogic 月历结果态/动作（DI 唯一组装点）
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
        rescheduleBusyId,
        scheduleBusy,
        runBatchSchedule,
        undoAction,
        undoBusy,
        undoLast,
        dismissUndoAction,
        createTaskOnDay,
        openTaskDetails,
        tasks,
        sortedTasks,
        sort,
        weekStart,
        quickCreateDate,
        quickCreatePending,
        openQuickCreate,
        closeQuickCreate,
        inlineCreateTask,
        selectedProjectIds,
        selectedTagIds,
        hideCompleted,
        clearFilter,
        goPrevDay,
        goNextDay,
        goPrevWeek,
        goNextWeek
    } = useCalendarMonthly(laneLimit)

    // @viewContext 应用级子侧栏开关 + 专注徽标/事件订阅
    const { isDisplayAside, switchDisplayAside } = inject(INDEX_VIEW_CONTEXT_KEY)!
    const { pomodoroBadge, subscriber } = inject(CALENDAR_VIEW_CONTEXT_KEY)!

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

    // @computed 筛选激活态（空态出口）
    const filterActive = computed(
        () => selectedProjectIds.value.length > 0 || selectedTagIds.value.length > 0
    )
    // @computed 未安排按钮灰态：仅真无（N=0 且非筛选/隐藏完成所致）时禁用
    const unscheduledBtnDisabled = computed(
        () => unscheduledTasks.value.length === 0 && !filterActive.value && !hideCompleted.value
    )

    // @states 当日面板 / 未安排抽屉（结果态：宿主唯一）
    const dayDrawerDate = ref('')
    const dayDrawerOpen = ref(false)
    const dayTasks = computed(() => (dayDrawerDate.value ? getDayTasks(dayDrawerDate.value) : []))
    const unscheduledOpen = ref(false)

    // @method 打开某日面板（同时选中该日）
    const openDay = (dateKey: string) => {
        selectDate(dateKey)
        dayDrawerDate.value = dateKey
        dayDrawerOpen.value = true
    }
    const openTaskFromPanel = (taskId: TaskViewObject['id']) => {
        openTaskDetails(taskId)
    }
    // @method 当日面板「本周」下钻：锚定该日并切到周视图
    const showWeekOf = (dateKey: string) => {
        selectDate(dateKey)
        toWeek()
        dayDrawerOpen.value = false
    }

    // @method 锚点月同步：切回月视图前把月定位到选中日所在月
    const syncAnchorMonth = () => {
        const anchor = dayjs(selectedKey.value)
        if (!anchor.isValid()) return
        year.value = anchor.year()
        monthIndex.value = anchor.month()
    }
    const goToMonthView = () => {
        syncAnchorMonth()
        toMonth()
    }
    const goToWeekView = () => toWeek()
    const goToDayView = () => toDay()

    // —— F1 拖拽排期会话（宿主唯一：月/周网格 + 未安排抽屉行共用；busy 禁起） ——
    const drag = useDragSchedule({
        isBusy: () => rescheduleBusyId.value !== '' || scheduleBusy.value || undoBusy.value,
        closeUnscheduled: () => {
            unscheduledOpen.value = false
        },
        scheduleOne: scheduleToDay
    })
    // 切视图：取消进行中手势 + 关闭格内编辑器（防悬挂会话）
    watch(viewMode, () => {
        drag.cancel()
        closeQuickCreate()
    })

    // —— C9 撤销呈现唯一：宿主唯一 toast 挂载点；daily 时间轴栈经本通道上报 ——
    const delegatedUndo = shallowRef<CalendarUndoPayload | null>(null)
    provide(CALENDAR_UNDO_SINK_KEY, {
        report: (payload: CalendarUndoPayload) => {
            // 最近一次动作：daily 新动作替换宿主旧动作（旧入口不可再撤销）
            dismissUndoAction()
            delegatedUndo.value = payload
        },
        clear: () => {
            delegatedUndo.value = null
        }
    })
    // 宿主自身新动作 = 最近一次动作：清掉 daily 上报，保证「最近一次」语义与单 toast
    watch(undoAction, (action) => {
        if (action) delegatedUndo.value = null
    })
    const activeUndo = computed(() => {
        const delegated = delegatedUndo.value
        if (delegated) {
            return {
                action: delegated.action,
                busy: delegated.busy.value,
                undo: delegated.undo,
                dismiss: delegated.dismiss
            }
        }
        if (undoAction.value) {
            return {
                action: undoAction.value,
                busy: undoBusy.value || scheduleBusy.value,
                undo: undoLast,
                dismiss: dismissUndoAction
            }
        }
        return null
    })

    // —— C1-F8 键盘导航（calendar scope 激活窗口 = 宿主挂载期；三视图共享） ——
    useScope(CALENDAR_KEY_SCOPE)
    const calendarKeyLocked = (): boolean => isCalendarKeyLocked(document)
    const guardNav = (action: () => void) => (): void => {
        if (calendarKeyLocked()) return
        action()
    }
    const NAV_GROUP = '日历'
    const navPrev = (): void => {
        if (viewMode.value === 'month') goPrevMonth()
        else if (viewMode.value === 'week') goPrevWeek()
        else goPrevDay()
    }
    const navNext = (): void => {
        if (viewMode.value === 'month') goNextMonth()
        else if (viewMode.value === 'week') goNextWeek()
        else goNextDay()
    }
    useShortcut('calendar.nav.prev', 'arrowleft', guardNav(navPrev), {
        scope: CALENDAR_KEY_SCOPE,
        label: '上个月/上周/前一天',
        group: NAV_GROUP,
        preventDefault: true
    })
    useShortcut('calendar.nav.next', 'arrowright', guardNav(navNext), {
        scope: CALENDAR_KEY_SCOPE,
        label: '下个月/下周/后一天',
        group: NAV_GROUP,
        preventDefault: true
    })
    useShortcut(
        'calendar.nav.today',
        't',
        guardNav(() => goToToday()),
        {
            scope: CALENDAR_KEY_SCOPE,
            label: '回到今天',
            group: NAV_GROUP
        }
    )
    useShortcut(
        'calendar.nav.week',
        'w',
        guardNav(() => goToWeekView()),
        {
            scope: CALENDAR_KEY_SCOPE,
            label: '切到周视图',
            group: NAV_GROUP
        }
    )
    useShortcut(
        'calendar.nav.month',
        'm',
        guardNav(() => goToMonthView()),
        {
            scope: CALENDAR_KEY_SCOPE,
            label: '切到月视图',
            group: NAV_GROUP
        }
    )
    useShortcut(
        'calendar.quick-create',
        'n',
        guardNav(() => openQuickCreate(selectedKey.value || todayDateKey())),
        { scope: CALENDAR_KEY_SCOPE, label: '在选中日快速新建', group: NAV_GROUP }
    )
    useShortcut('calendar.open-day', 'enter', () => openDay(selectedKey.value || todayDateKey()), {
        scope: CALENDAR_KEY_SCOPE,
        label: '打开当日面板',
        group: NAV_GROUP,
        preventDefault: true,
        available: (context) =>
            !calendarKeyLocked() && !isInteractiveKeyTarget(context.event?.target)
    })

    // —— 月视图上下文（渲染件消费；`onGoMonth` 由 active 月按钮自持，不绑导航） ——
    provide<CalendarMonthlyContext>(CALENDAR_MONTHLY_CONTEXT_KEY, {
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
        rescheduleBusyId,
        scheduleBusy,
        runBatchSchedule,
        undoAction,
        undoBusy,
        undoLast,
        dismissUndoAction,
        createTaskOnDay,
        openTaskDetails,
        goPrevDay,
        goNextDay,
        goPrevWeek,
        goNextWeek,
        tasks,
        sortedTasks,
        sort,
        weekStart,
        quickCreateDate,
        quickCreatePending,
        openQuickCreate,
        closeQuickCreate,
        inlineCreateTask,
        selectedProjectIds,
        selectedTagIds,
        hideCompleted,
        clearFilter,
        laneLimit,
        drag,
        onOpenDay: openDay,
        onOpenUnscheduled: () => (unscheduledOpen.value = true),
        onCloseUnscheduled: () => (unscheduledOpen.value = false),
        onGoWeekView: goToWeekView,
        onGoDayView: goToDayView,
        badgeLabel,
        unscheduledDisabled: unscheduledBtnDisabled,
        filterActive
    })

    // —— O14 周视图上下文 ——
    provide<CalendarWeeklyContext>(CALENDAR_WEEKLY_CONTEXT_KEY, {
        loading,
        error,
        onRetry: retry,
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
        onGoDay: goToDayView,
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

    // —— TASK-16 日视图上下文（C14：复用同一 sortedTasks 快照，切视图不重拉） ——
    provide<CalendarDayContext>(CALENDAR_DAY_CONTEXT_KEY, {
        loading,
        error,
        onRetry: retry,
        anchorKey: selectedKey,
        todayKey: todayDateKey(),
        tasks: sortedTasks,
        sort,
        isDisplayAside,
        switchDisplayAside,
        onOpenTask: openTaskFromPanel,
        onTaskCreated: (taskId) => subscriber.emit('AddNewTaskId', taskId),
        onOpenUnscheduled: () => (unscheduledOpen.value = true),
        onOpenDay: openDay,
        onPrevDay: goPrevDay,
        onNextDay: goNextDay,
        onGoToday: goToToday,
        onGoMonth: goToMonthView,
        onGoWeek: goToWeekView,
        filterActive,
        hideCompleted,
        onClearFilter: clearFilter,
        onShowCompleted: () => (hideCompleted.value = false),
        unscheduledCount: computed(() => unscheduledTasks.value.length),
        unscheduledDisabled: unscheduledBtnDisabled
    })

    return {
        viewMode,
        laneLimit,
        drag,
        activeUndo,
        dayDrawerDate,
        dayDrawerOpen,
        dayTasks,
        unscheduledOpen,
        toggleDone,
        deferToToday,
        openTaskFromPanel,
        createTaskOnDay,
        showWeekOf,
        unscheduledTasks,
        filterActive,
        hideCompleted,
        clearFilter,
        scheduleBusy,
        rescheduleBusyId,
        scheduleToDay,
        runBatchSchedule
    }
}