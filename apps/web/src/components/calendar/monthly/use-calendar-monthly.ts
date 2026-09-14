import { TASK_CREATOR_DIALOG_KEY, unwrapError } from '@nao-todo/shared'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { translateTaskError, useTasksStore } from '@nao-todo/presentation/task'
import { useTaskUseCase } from '@/hooks'
import { NueMessage } from 'nue-ui'
import dayjs from 'dayjs'
import { computed, inject, ref, watch, type Ref } from 'vue'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import {
    buildGridModel,
    dateKeyOf,
    MAX_VISIBLE_LANES,
    spanCoversDate,
    todayDateKey
} from './monthly-layout'
import { isDateKeyInMonth, monthFirstDateKey } from './month-jump'
import { useCalendarTaskQuery } from './use-calendar-task-query'
import { useCalendarSchedule } from './use-calendar-schedule'

/**
 * useCalendarMonthly
 * @description 月历视图逻辑组装（O12 拆分后）：任务拉取/订阅（useCalendarTaskQuery）与
 *              排期/撤销（useCalendarSchedule）已抽离；本组合式保留视图导航、选中、模型、
 *              快速新建、任务详情等，并作为 DI 唯一组装点（store/usecase 在此创建并注入）。
 * @param laneLimit 每行可视轨道数（渲染侧按行高动态测得；缺省回退 3）
 */
const useCalendarMonthly = (laneLimit?: Ref<number>) => {
    // @dynamic 可视轨道数（外部测得传入；未提供时使用默认回退值）
    const internalLaneLimit = laneLimit ?? ref(MAX_VISIBLE_LANES)
    // @viewContext 日历视图上下文
    const {
        dialogManager,
        subscriber,
        showTaskDetails,
        selectedProjectIds,
        selectedTagIds,
        hideCompleted,
        clearFilter,
        weekStart
    } = inject(CALENDAR_VIEW_CONTEXT_KEY)!

    // @dataStore 任务缓存（与任务区共用全局 map，变更即时联动）
    const tasksStore = useTasksStore()

    // @usecase 业务依赖在此由组合式组装（DI 入口；不来自视图上下文）
    const taskUseCase = useTaskUseCase(tasksStore)

    // —— O12 拆分子组合式：任务拉取+订阅 / 排期+撤销（DI 依赖由本组装点注入） ——
    const { loading, error, retry, tasks, unscheduledTasks } = useCalendarTaskQuery({
        tasksStore,
        taskUseCase
    })
    const {
        rescheduleBusyId,
        scheduleBusy,
        runBatchSchedule,
        undoAction,
        undoBusy,
        undoLast,
        dismissUndoAction,
        scheduleToDay,
        deferToToday
    } = useCalendarSchedule({ taskUseCase })

    // @states 视图状态
    const year = ref<number>(dayjs().year())
    const monthIndex = ref<number>(dayjs().month()) // 0-based
    const selectedKey = ref<string>(todayDateKey())

    // @computed 当前月标题
    const monthTitle = computed(() => `${year.value} 年 ${monthIndex.value + 1} 月`)

    // @computed 网格模型（快照任务即服务端过滤结果 -> 行/轨道/溢出）
    const model = computed(() =>
        buildGridModel(
            year.value,
            monthIndex.value,
            tasks.value,
            selectedKey.value,
            internalLaneLimit.value,
            weekStart.value
        )
    )

    // @method 某日的任务列表（含跨月任务，按 R6 排序；数据源与网格一致）
    const getDayTasks = (dateKey: string): TaskViewObject[] => {
        return tasks.value
            .filter((task) => spanCoversDate(task, dateKey))
            .sort((a, b) => {
                const aStart = dayjs(a.startAt || a.endAt).valueOf()
                const bStart = dayjs(b.startAt || b.endAt).valueOf()
                return (
                    aStart - bStart || dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf()
                )
            })
    }

    // @method 翻月/回今天
    const goPrevMonth = () => {
        const m = dayjs(new Date(year.value, monthIndex.value, 1)).subtract(1, 'month')
        year.value = m.year()
        monthIndex.value = m.month()
    }
    const goNextMonth = () => {
        const m = dayjs(new Date(year.value, monthIndex.value, 1)).add(1, 'month')
        year.value = m.year()
        monthIndex.value = m.month()
    }
    const goToToday = () => {
        const now = dayjs()
        year.value = now.year()
        monthIndex.value = now.month()
        selectedKey.value = todayDateKey()
    }

    // @method 月视图跳转（C2-F9）：锚定所选年月（与 ←/→ 翻月同一 anchor 状态源，不开当日面板）；
    //              原选中日落在目标月内则保留高亮，否则清除选中（C-F9-05）
    const jumpToMonth = (targetYear: number, targetMonth: number): void => {
        year.value = targetYear
        monthIndex.value = targetMonth - 1
        if (selectedKey.value && !isDateKeyInMonth(selectedKey.value, targetYear, targetMonth)) {
            selectedKey.value = ''
        }
    }

    // @method 周视图跳转（C2-F9）：落含所选月 1 号的周并选中 1 号（周锚点=selectedKey，
    //              周起点按 weekStart 口径）；同步月锚点为所选月供切回月视图定位
    const jumpToWeekOfMonthFirst = (targetYear: number, targetMonth: number): void => {
        selectedKey.value = monthFirstDateKey(targetYear, targetMonth)
        year.value = targetYear
        monthIndex.value = targetMonth - 1
    }

    // @states 视图模式（A1：月/周切换；默认月）
    const viewMode = ref<'month' | 'week'>('month')

    // @method 锚点月同步：切回月视图前把月定位到选中日所在月（跨月周导航后仍准确定位）
    const syncAnchorMonth = () => {
        const anchor = dayjs(selectedKey.value)
        if (!anchor.isValid()) return
        year.value = anchor.year()
        monthIndex.value = anchor.month()
    }

    // @method 视图切换（不重拉数据：复用同一筛选/任务快照）
    const goToWeekView = () => {
        viewMode.value = 'week'
    }
    const goToMonthView = () => {
        syncAnchorMonth()
        viewMode.value = 'month'
    }

    // @method 周导航：±7 天移动锚点（周视图头部用；月份由 syncAnchorMonth 延迟对齐）
    const goPrevWeek = () => {
        selectedKey.value = dateKeyOf(dayjs(selectedKey.value).subtract(7, 'day').valueOf())
    }
    const goNextWeek = () => {
        selectedKey.value = dateKeyOf(dayjs(selectedKey.value).add(7, 'day').valueOf())
    }

    // @states 格内快速新建（B6：单编辑器按 dateKey 定位；同视图仅一个）
    const quickCreateDate = ref('')
    const quickCreatePending = ref(false)

    // @method 打开/关闭 快速新建编辑器
    const openQuickCreate = (dateKey: string) => {
        quickCreateDate.value = dateKey
    }
    const closeQuickCreate = () => {
        quickCreateDate.value = ''
    }

    // @watch 翻月/翻周/换视图/切日期 → 编辑器自动关闭（随所在格失效，不残留）
    watch([year, monthIndex, selectedKey, viewMode], () => {
        quickCreateDate.value = ''
    })

    // @method 单选范围预填（Q5：单清单无标签→projectId；单标签无清单→tags；多选/混合省略走默认）
    const prefillScope = (): { projectId?: string; tags?: string[] } => {
        if (selectedProjectIds.value.length === 1 && selectedTagIds.value.length === 0) {
            return { projectId: selectedProjectIds.value[0] }
        }
        if (selectedTagIds.value.length === 1 && selectedProjectIds.value.length === 0) {
            return { tags: [selectedTagIds.value[0]!] }
        }
        return {}
    }

    // @method 格内回车创建：仅名称；endAt=该日末、startAt 不设；成功广播 AddNewTaskId 不跳详情
    const inlineCreateTask = async (dateKey: string, rawName: string): Promise<boolean> => {
        const name = (rawName || '').trim()
        if (!name || quickCreatePending.value) return false
        quickCreatePending.value = true
        try {
            const scope = prefillScope()
            const [task, err] = await taskUseCase.create({
                projectId: scope.projectId ?? '',
                name,
                description: '',
                state: 'todo',
                priority: 'low',
                startAt: null,
                endAt: dayjs(dateKey).endOf('day').toISOString(),
                tags: scope.tags ?? [],
                remindAt: null,
                remindRepeat: 'none',
                remindTime: null,
                remindWeekdays: []
            })
            if (err !== null) {
                NueMessage.error(translateTaskError(err))
                return false
            }
            if (task) subscriber.emit('AddNewTaskId', task.id)
            quickCreateDate.value = ''
            return true
        } finally {
            quickCreatePending.value = false
        }
    }

    // @method 选中日期
    const selectDate = (dateKey: string) => {
        selectedKey.value = dateKey
    }

    // @method 勾选/还原完成状态（语义与任务页一致：done <-> todo）
    const toggleDone = async (task: TaskViewObject): Promise<void> => {
        const nextState = task.state === 'done' ? 'todo' : 'done'
        const err = await taskUseCase.update(task.id, {
            state: nextState,
            updatedAt: dayjs().toISOString()
        })
        if (err !== null) NueMessage.error(unwrapError(err))
    }

    // @method 以某日为截止日新建任务（打开创建器并预填当日 + 当前范围上下文）
    const createTaskOnDay = (dateKey: string) => {
        const payload: { startAt: string; endAt: string } & Record<string, unknown> = {
            startAt: dayjs(dateKey).startOf('day').toISOString(),
            endAt: dayjs(dateKey).endOf('day').toISOString()
        }
        // Q5 联动：单选清单/标签预填（多选/混合省略走默认收件箱）
        const scope = prefillScope()
        if (scope.projectId) payload.projectId = scope.projectId
        if (scope.tags) payload.tags = scope.tags
        dialogManager.open(TASK_CREATOR_DIALOG_KEY, payload)
    }

    // @method 打开任务详情（日历区内嵌详情适配器）
    const openTaskDetails = (taskId: TaskViewObject['id']) => {
        showTaskDetails(taskId)
    }

    // @returns
    return {
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
        // —— 标题年月跳转（C2-F9）：anchor 状态源 + 视图跳转动作 ——
        year,
        monthIndex,
        jumpToMonth,
        jumpToWeekOfMonthFirst,
        getDayTasks,
        toggleDone,
        deferToToday,
        scheduleToDay,
        unscheduledTasks,
        // —— 单条排期/改期（F4）busy 标识（逐任务防连点，月/周条 + 抽屉行共用） ——
        rescheduleBusyId,
        // —— 批量排期（F3）+ U2 最近一次撤销（M2/F4、M3/F1 复用） ——
        scheduleBusy,
        runBatchSchedule,
        undoAction,
        undoBusy,
        undoLast,
        dismissUndoAction,
        createTaskOnDay,
        openTaskDetails,
        // —— 视图态（A1 周视图） ——
        viewMode,
        goToWeekView,
        goToMonthView,
        goPrevWeek,
        goNextWeek,
        // —— 任务快照（周视图同源数据；含跨月任务，按跨度裁剪） ——
        tasks,
        // —— 周起始口径（C9） ——
        weekStart,
        // —— 格内快速新建（B6） ——
        quickCreateDate,
        quickCreatePending,
        openQuickCreate,
        closeQuickCreate,
        inlineCreateTask,
        // —— 筛选（空态/清除出口使用） ——
        selectedProjectIds,
        selectedTagIds,
        hideCompleted,
        clearFilter
    }
}

export default useCalendarMonthly