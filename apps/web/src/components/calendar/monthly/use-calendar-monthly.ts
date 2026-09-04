import { TASK_CREATOR_DIALOG_KEY, unwrapError } from '@nao-todo/shared'
import type { GetTasksOptions } from '@nao-todo/shared'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '@nao-todo/presentation/task'
import { NueMessage } from 'nue-ui'
import dayjs from 'dayjs'
import { computed, inject, onMounted, onUnmounted, ref } from 'vue'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { buildGridModel, spanCoversDate, todayDateKey } from './monthly-layout'
import { matchTaskFilter } from '../task-filter'

// 数据获取约束（Q1 默认）：拉取顶层/未删除/未归档/未放弃任务（含已完成），
// 分页拉全并设置数量上限，客户端按日期分桶。查询契约无任意日期范围能力，
// 后续后端支持按区间查询后可替换 loadAll 的实现而无需改动 UI。
const PAGE_LIMIT = 100
const MAX_PAGES = 10 // 上限 1000 条

/**
 * useCalendarMonthly
 * @description 月历视图逻辑：任务全量拉取（客户端分桶）+ 翻月 + 日期选中 +
 *              网格模型计算 + 完成切换/当日新建/打开详情等动作。
 */
const useCalendarMonthly = () => {
    // @viewContext 日历视图上下文
    const {
        taskUseCase,
        dialogManager,
        subscriber,
        showTaskDetails,
        selectedProjectIds,
        selectedTagIds,
        hideCompleted,
        clearFilter
    } = inject(CALENDAR_VIEW_CONTEXT_KEY)!

    // @dataStore 任务缓存（与任务区共用全局 map，变更即时联动）
    const tasksStore = useTasksStore()

    // @states 视图状态
    const loading = ref<boolean>(true) // 任务加载中
    const error = ref<string>('') // 任务加载错误
    const loadingLocked = ref<boolean>(false) // 防重复请求
    const taskIds = ref<Set<TaskViewObject['id']>>(new Set()) // 已加载任务快照
    const year = ref<number>(dayjs().year())
    const monthIndex = ref<number>(dayjs().month()) // 0-based
    const selectedKey = ref<string>(todayDateKey())

    // @method 任务加载（拉全部分页并归并到快照）
    const loadAll = async (): Promise<void> => {
        if (loadingLocked.value) return
        loadingLocked.value = true
        error.value = ''
        loading.value = taskIds.value.size === 0
        const nextIds = new Set<TaskViewObject['id']>()
        try {
            for (let page = 1; page <= MAX_PAGES; page++) {
                const getOptions: GetTasksOptions = {
                    isGivenUp: false,
                    isDeleted: false,
                    isArchived: false,
                    sort: { field: 'startAt', order: 'asc' },
                    limit: PAGE_LIMIT,
                    page
                }
                const [res, err] = await taskUseCase.list(getOptions)
                if (err !== null) {
                    error.value = unwrapError(err)
                    break
                }
                res.taskIds.forEach((id) => nextIds.add(id))
                const maxPage = res.pagination?.maxPage ?? page
                const isLastPage = res.taskIds.length < PAGE_LIMIT || page >= maxPage
                if (isLastPage) break
            }
            if (!error.value) taskIds.value = nextIds
        } finally {
            loading.value = false
            loadingLocked.value = false
        }
    }

    // @method 事件订阅刷新（与其他任务区一致：RefreshData 全量、AddNewTaskId 增量）
    const onRefreshData = () => {
        taskIds.value = new Set()
        loadAll()
    }
    const onAddNewTaskId = (id: TaskViewObject['id']) => {
        taskIds.value = new Set(taskIds.value).add(id)
    }

    // @lifecycle
    onMounted(() => {
        loadAll()
        subscriber.subscribe('RefreshData', onRefreshData)
        subscriber.subscribe('AddNewTaskId', onAddNewTaskId)
    })
    onUnmounted(() => {
        subscriber.unsubscribe('RefreshData', onRefreshData)
        subscriber.unsubscribe('AddNewTaskId', onAddNewTaskId)
    })

    // @computed 快照对应的任务对象（map 项被改期/勾选后自动联动）
    const tasks = computed<TaskViewObject[]>(() =>
        [...taskIds.value]
            .map((id) => tasksStore.getTask(id))
            .filter((task): task is TaskViewObject => !!task)
    )

    // @computed 经筛选后可见的任务（侧边栏复选框/头部范围/隐藏已完成）
    const visibleTasks = computed<TaskViewObject[]>(() =>
        tasks.value.filter((task) =>
            matchTaskFilter(task, {
                projectIds: selectedProjectIds.value,
                tagIds: selectedTagIds.value,
                hideCompleted: hideCompleted.value
            })
        )
    )

    // @computed 当前月标题
    const monthTitle = computed(() => `${year.value} 年 ${monthIndex.value + 1} 月`)

    // @computed 网格模型（可见任务 -> 行/轨道/溢出）
    const model = computed(() =>
        buildGridModel(year.value, monthIndex.value, visibleTasks.value, selectedKey.value)
    )

    // @method 某日的任务列表（含跨月任务，按 R6 排序；数据源与网格一致为可见任务）
    const getDayTasks = (dateKey: string): TaskViewObject[] => {
        return visibleTasks.value
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
        // Q5 联动：恰好选中单一清单或标签时预填，多选/混合不预填避免歧义
        if (selectedProjectIds.value.length === 1 && selectedTagIds.value.length === 0) {
            payload.projectId = selectedProjectIds.value[0]
        } else if (selectedTagIds.value.length === 1 && selectedProjectIds.value.length === 0) {
            payload.tags = [selectedTagIds.value[0]]
        }
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
        retry: loadAll,
        model,
        monthTitle,
        selectedKey,
        selectDate,
        goPrevMonth,
        goNextMonth,
        goToToday,
        getDayTasks,
        toggleDone,
        createTaskOnDay,
        openTaskDetails,
        // —— 筛选（空态/清除出口使用） ——
        selectedProjectIds,
        selectedTagIds,
        hideCompleted,
        clearFilter
    }
}

export default useCalendarMonthly