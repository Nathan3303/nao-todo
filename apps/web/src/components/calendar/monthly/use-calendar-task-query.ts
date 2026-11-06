import { unwrapError } from '@nao-todo/shared/utils/user-facing-go-error'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { useTasksStore } from '@nao-todo/presentation/task'
import { useTaskUseCase } from '@/hooks'
import { buildCalendarListQuery, MAX_PAGES, PAGE_LIMIT } from './list-query'

/**
 * 原地刷新失败的「用户可读原因」清洗（`T665`）
 * @description 空串 / 纯业务码（如 `10051`）不外泄 ⇒ 返回空串，由视图走兜底句式。
 *              与 `presentation/task` 加载器同口径（此处单点实现，避免跨层依赖）。
 */
const toRefreshReason = (text: string): string => {
    const trimmed = text.trim()
    return /^\d+$/.test(trimmed) ? '' : trimmed
}

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
    const error = ref<string>('') // 任务加载错误（阻塞式：无内容可保时落错误分支）
    /**
     * 原地刷新失败（非阻塞，`DEF-148`）
     * @description 自动刷新（`RefreshData`）失败时**保留已有快照**，改用提示条表达失败；
     *              下轮成功自动消除（不残留、不刷屏）。
     */
    /**
     * 原地刷新失败（非阻塞，`DEF-148`）
     * @description `T665` 两态编码：`null` = 无失败；`''` = 失败但无可读原因（空文本 / 裸业务码已清洗）
     *              ⇒ **显示判据必须是 `!== null`**（不得用真假值，否则空文案会让提示条消失）。
     *              下轮成功自动回到 `null`（不残留、不刷屏）。
     */
    const refreshError = ref<string | null>(null)
    const taskIds = ref<Set<TaskViewObject['id']>>(new Set()) // 已加载任务快照
    const pendingLoad = ref<boolean>(false) // 拉取请求合并标记（运行中触发只补跑一次）

    // @method 单次全量拉取（服务端过滤，分页归并到快照；只携带发起时的筛选条件）
    // @description `DEF-148`：失败时按「有无内容」分流 —— 有内容 ⇒ 保留快照 + `refreshError`
    //              （非破坏性提示条）；无内容 ⇒ 既有 `error` 分支（首进即失败仍要正常错误态）。
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
        } catch (thrown) {
            // 仓储/请求层意外抛错（如异常响应形状）不冒泡为未处理拒绝：归一为错误态
            error.value = unwrapError(thrown as Error)
        } finally {
            if (error.value && taskIds.value.size > 0) {
                // 有内容 ⇒ 保留快照，失败降级为非阻塞提示（不清空日历、不换错误分支）
                refreshError.value = toRefreshReason(error.value)
                error.value = ''
            } else if (!error.value) {
                refreshError.value = null
            }
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

    // @method 清空并重新拉取（筛选变化 / 首进 / 用户重试的出口）
    const resetAndLoad = (): void => {
        taskIds.value = new Set()
        requestLoad()
    }

    // @method 原地刷新（`RefreshData` 出口）
    // @description `DEF-144` 日历落点：**不清空快照**（清空会让 `runSweep` 把 `loading` 置真 ⇒
    //              整个月历被加载块替换）；快照在成功后整体替换（失败则保留 + 提示条）。
    const refreshInPlace = (): void => {
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
        refreshInPlace()
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

    // 未安排任务（B7：endAt 为空）不再由本组合式排序：展示顺序唯一真源＝用户排序，
    // 故由组装点（useCalendarMonthly）从 sortedTasks 派生（TASK-15 D4）。

    return { loading, error, refreshError, retry: resetAndLoad, tasks }
}