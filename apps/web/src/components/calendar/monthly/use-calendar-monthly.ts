import { TASK_CREATOR_DIALOG_KEY, unwrapError } from '@nao-todo/shared'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '@nao-todo/presentation/task'
import { useTaskUseCase } from '@/hooks'
import { NueMessage } from 'nue-ui'
import dayjs from 'dayjs'
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { buildGridModel, spanCoversDate, todayDateKey } from './monthly-layout'
import { buildCalendarListQuery, MAX_PAGES, PAGE_LIMIT } from './list-query'

/**
 * useCalendarMonthly
 * @description 月历视图逻辑：任务全量拉取（服务端过滤：多清单/多标签/隐藏已完成，
 *              顶层/未删除/未归档/未放弃）+ 翻月 + 日期选中 + 网格模型计算 +
 *              完成切换/当日新建/打开详情等动作。
 */
const useCalendarMonthly = () => {
    // @viewContext 日历视图上下文
    const {
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

    // @usecase 业务依赖在此由组合式组装（DI 入口；不来自视图上下文）
    const taskUseCase = useTaskUseCase(tasksStore)

    // @states 视图状态
    const loading = ref<boolean>(true) // 任务加载中
    const error = ref<string>('') // 任务加载错误
    const taskIds = ref<Set<TaskViewObject['id']>>(new Set()) // 已加载任务快照
    const pendingLoad = ref<boolean>(false) // 拉取请求合并标记（运行中触发只补跑一次）
    const year = ref<number>(dayjs().year())
    const monthIndex = ref<number>(dayjs().month()) // 0-based
    const selectedKey = ref<string>(todayDateKey())

    // @method 单次全量拉取（服务端过滤，分页归并到快照；只携带发起时的筛选条件）
    const runSweep = async (): Promise<void> => {
        error.value = ''
        loading.value = taskIds.value.size === 0
        const nextIds = new Set<TaskViewObject['id']>()
        try {
            for (let page = 1; page <= MAX_PAGES; page++) {
                const getOptions = buildCalendarListQuery(
                    {
                        projectIds: selectedProjectIds.value,
                        tagIds: selectedTagIds.value,
                        hideCompleted: hideCompleted.value
                    },
                    page
                )
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
        }
    }

    // @method 请求全量拉取（运行中合并：结束后若又有请求则补跑，防快速连点丢最后一次变化）
    const requestLoad = (): void => {
        if (pendingLoad.value) return
        pendingLoad.value = true
        void (async () => {
            while (pendingLoad.value) {
                pendingLoad.value = false
                await runSweep()
            }
        })()
    }

    // @method 清空并重新拉取（筛选变化/刷新/重试统一出口）
    const resetAndLoad = (): void => {
        taskIds.value = new Set()
        requestLoad()
    }

    // @computed 筛选是否激活（服务端查询条件非空；空态文案复用）
    const filterActive = computed(
        () =>
            selectedProjectIds.value.length > 0 ||
            selectedTagIds.value.length > 0 ||
            hideCompleted.value
    )

    // @watch 筛选变化 -> 重置快照并按新条件服务端重查（快速连点由 requestLoad 合并）
    watch([selectedProjectIds, selectedTagIds, hideCompleted], () => resetAndLoad(), { deep: true })

    // @method 事件订阅刷新（与其他任务区一致：RefreshData 全量、AddNewTaskId 增量）
    const onRefreshData = () => {
        resetAndLoad()
    }
    const onAddNewTaskId = (id: TaskViewObject['id']) => {
        // 服务端过滤激活时，增量 id 可能不匹配当前范围：改为全量重查保证一致
        if (filterActive.value) {
            resetAndLoad()
            return
        }
        taskIds.value = new Set(taskIds.value).add(id)
    }

    // @lifecycle
    onMounted(() => {
        resetAndLoad()
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

    // @computed 当前月标题
    const monthTitle = computed(() => `${year.value} 年 ${monthIndex.value + 1} 月`)

    // @computed 网格模型（快照任务即服务端过滤结果 -> 行/轨道/溢出）
    const model = computed(() =>
        buildGridModel(year.value, monthIndex.value, tasks.value, selectedKey.value)
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
        retry: resetAndLoad,
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