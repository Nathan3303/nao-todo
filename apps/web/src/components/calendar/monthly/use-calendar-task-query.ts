import { unwrapError } from '@nao-todo/shared'
import type { TaskViewObject } from '@nao-todo/domain-task'
import dayjs from 'dayjs'
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { useTasksStore } from '@nao-todo/presentation/task'
import { useTaskUseCase } from '@/hooks'
import { buildCalendarListQuery, MAX_PAGES, PAGE_LIMIT } from './list-query'

/**
 * useCalendarTaskQuery —— 日历任务快照拉取与订阅（O12 拆分）
 * @description 服务端过滤全量拉取（多清单/多标签/隐藏已完成，顶层/未删除/未归档/未放弃）
 *              + 分页归并到快照 + RefreshData 全量 / AddNewTaskId 增量订阅 + 筛选变化重查。
 * @param deps.taskUseCase / deps.tasksStore 由组装点（useCalendarMonthly）创建注入，DI 入口单一
 */
export const useCalendarTaskQuery = (deps: {
    tasksStore: ReturnType<typeof useTasksStore>
    taskUseCase: ReturnType<typeof useTaskUseCase>
}) => {
    const { tasksStore, taskUseCase } = deps

    // @viewContext 筛选与事件订阅（视图上下文；与任务区共用）
    const { subscriber, selectedProjectIds, selectedTagIds, hideCompleted } =
        inject(CALENDAR_VIEW_CONTEXT_KEY)!

    // @states 任务快照与拉取状态
    const loading = ref<boolean>(true) // 任务加载中
    const error = ref<string>('') // 任务加载错误
    const taskIds = ref<Set<TaskViewObject['id']>>(new Set()) // 已加载任务快照
    const pendingLoad = ref<boolean>(false) // 拉取请求合并标记（运行中触发只补跑一次）

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

    // @computed 筛选是否激活（服务端查询条件非空；增量订阅判定用，含 hideCompleted）
    const filterActive = computed(
        () =>
            selectedProjectIds.value.length > 0 ||
            selectedTagIds.value.length > 0 ||
            hideCompleted.value
    )

    // @watch 筛选变化 -> 重置快照并按新条件服务端重查（快速连点由 requestLoad 合并）
    watch([selectedProjectIds, selectedTagIds, hideCompleted], () => resetAndLoad(), {
        deep: true
    })

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

    // @lifecycle 挂载拉取 + 订阅；卸载退订
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

    // @computed 未安排任务（B7：endAt 为空；数据源=当前筛选下全量快照，不限当月；createdAt desc）
    const unscheduledTasks = computed<TaskViewObject[]>(() =>
        tasks.value
            .filter((task) => !task.endAt)
            .sort(
                (a, b) =>
                    dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf() ||
                    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
            )
    )

    return { loading, error, retry: resetAndLoad, tasks, unscheduledTasks }
}