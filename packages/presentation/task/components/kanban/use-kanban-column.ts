import type { GetTasksOptions } from '@nao-todo/shared/constants'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { computed, onMounted, onUnmounted, ref, toRef, watchEffect } from 'vue'
import { useTasksLoader } from '../../hooks'
import {
    kanbanColumnGetTasksOptions,
    type KanbanColumnResetOptions
} from './use-kanban-column-paging'
import type { TaskKanbanColumnProps, TaskKanbanContext } from './types'

/**
 * 看板列（列内**自持分页**，ADR `docs/adr/2026-11-01-kanban-column-paging.md`）
 *
 * @description `DEF-126`：列不再吃父级传入的 `tasks`（一次性 ≤20 条），而是**每列自己**持有一个
 *              `useTasksLoader`，按「用户基础筛选 ∩ 列条件」查本地仓储（R-E/R-I），触底加载该列
 *              下一页（R-A `limit=20`）。
 *
 * **两条红线（ADR）**
 *   1. **求交而非覆盖**（R-I）：求交为空 ⇒ 0 条且**不发请求**（`queryOptions === null`）。
 *   2. **`isDone` 与 loading 拆分**（R-K）：列内**不用**共享 loader 的 `isDone`
 *      （`res.taskIds.length < limit` 会把「恰好 20 条」误判为未到底）⇒ 覆盖为
 *      `page * limit >= total`；`loadingFirst` / `loadingMore` 分离 ⇒ 触底加载不得把整列
 *      换成「正在加载任务」。
 */
const useKanbanColumn = (props: TaskKanbanColumnProps, context: TaskKanbanContext) => {
    const { getTask, getTasksOptions, sortOptions, taskUseCase, paging } = context

    // 分组维度随 prop 变化（分组切换时列由 `:key` 重建，故此处只需转 ref）
    const groupBy = toRef(props, 'groupBy')

    /**
     * 列查询条件
     * @description `null` = 用户筛选与列条件求交为空 ⇒ 该列 0 条且**不发查询**（R-I）；
     *              排序以 `sortOptions` prop 为准（与页面一致，AC6② 判据）
     */
    const queryOptions = computed<GetTasksOptions | null>(() => {
        const base = kanbanColumnGetTasksOptions(
            getTasksOptions.value,
            groupBy.value,
            props.category
        )
        if (base === null) return null
        return { ...base, sort: sortOptions.value }
    })

    // @state 列内任务加载器（每列一份，游标互不影响 —— AC2 列间隔离）
    const loader = useTasksLoader(taskUseCase)

    // @state 源列被拖走一条 ⇒ 下次触底先补回已加载区间的尾部（偏移分页会跳过 1 条，R-M/D3）
    const needsRefill = ref(false)

    // @state 首屏是否已收敛（外层聚合摘要判据，R-N）
    const loadedOnce = ref(false)

    // @computed 列内是否到底：`page * limit >= total`（R-K，不用共享 loader 的 `length < limit`）
    const isDone = computed(
        () =>
            loader.states.pagination.page * loader.states.pagination.limit >=
            loader.states.pagination.total
    )

    // @computed 列内卡片（按 ID 解析 ⇒ 拖拽 / 新增后无需整板重查）
    const columnTasks = computed<TaskViewObject[]>(() =>
        [...loader.states.taskIds]
            .map((taskId) => getTask(taskId))
            .filter((task): task is TaskViewObject => Boolean(task))
    )

    // @computed 列头数字 = 该列**总数**（R-D / AC3）
    const total = computed(() => (queryOptions.value === null ? 0 : loader.states.pagination.total))

    // @computed 首屏加载（整列 loading 只在「一条都还没加载」时出现，R-K）
    const loadingFirst = computed(() => loader.states.loading && loader.states.taskIds.size === 0)

    // @computed 触底加载（列底 loading 条，不打断已有卡片，R-K）
    const loadingMore = computed(() => loader.states.loading && loader.states.taskIds.size > 0)

    // @computed 列内错误
    const error = computed(() => loader.states.error)

    /**
     * 加载第 1 页（重置入口）
     * @description 求交为空 ⇒ 清空并列头归 0，且**不发请求**（R-I / AC11）。
     *              `options.silent` ⇒ 原地刷新（`RefreshData`）：不置 loading ⇒ 列底不插加载条、
     *              空列占位不换成「正在加载任务」（`DEF-144` 看板落点，AC-K1）。
     *              ⛔ 首次进入 / 筛选排序变化 / 用户「重试」不走 silent（AC-K2）。
     */
    const loadFirstPage = async (options: KanbanColumnResetOptions = {}) => {
        needsRefill.value = false
        loader.states.pagination.page = 1
        if (queryOptions.value === null) {
            loader.states.taskIds = new Set<TaskViewObject['id']>()
            loader.states.pagination.total = 0
            loader.states.error = ''
            loader.states.loading = false
            loadedOnce.value = true
            return
        }
        await loader.loadAndReplace(queryOptions.value, { silent: options.silent === true })
        loadedOnce.value = true
    }

    /**
     * 触底：加载该列下一页
     * @description ① 有 `needsRefill` ⇒ 先**重取当前页**补回被拖走的那一条（Set 并集去重，
     *              不跳条也不重复 —— AC13）；② 否则 `page + 1` 追加（AC1）。
     */
    const loadMore = async () => {
        const options = queryOptions.value
        if (options === null) return
        if (loader.states.disabled) return
        if (needsRefill.value) {
            needsRefill.value = false
            if (loader.states.pagination.page > 1) await loader.loadAndPush(options)
            return
        }
        if (isDone.value) return
        loader.states.pagination.page += 1
        await loader.loadAndPush(options)
    }

    /**
     * 新增任务：目标列**置顶插入**并 `total + 1`（保页，R-M/D2）
     * @description 不重查 ⇒ 用户已滚的多页不会塌回第 1 页
     */
    const insertTask = (taskId: TaskViewObject['id']) => {
        if (loader.states.taskIds.has(taskId)) return
        loader.states.taskIds = new Set([taskId, ...loader.states.taskIds])
        loader.states.pagination.total += 1
    }

    /**
     * 拖走一条：移出并 `total - 1`
     * @description 已加载区间内被移走 ⇒ 标 `needsRefill`（偏移分页否则会跳过 1 条，R-M/D3）
     */
    const removeTask = (taskId: TaskViewObject['id']) => {
        const wasLoaded = loader.states.taskIds.has(taskId)
        loader.states.taskIds.delete(taskId)
        loader.states.pagination.total = Math.max(0, loader.states.pagination.total - 1)
        if (wasLoaded) needsRefill.value = true
    }

    /**
     * 重置回第 1 页（`RefreshData` / 筛选 / 排序，R-C）
     * @description 分组切换不经过这里：靠 `:key` 结构性重建（ADR 决策 3）
     */
    const reset = async (options?: KanbanColumnResetOptions) => {
        await loadFirstPage(options)
    }

    // @handle 注册到父级注册表（唯一编排入口，ADR 决策 1）
    const handle = { category: props.category, insertTask, removeTask, reset }
    paging.register(handle)

    // @effect 上报列摘要（外层空态 / 错误态判据，R-N）
    watchEffect(() => {
        paging.report(props.category, {
            settled: queryOptions.value === null || loadedOnce.value,
            total: total.value,
            firstError: error.value
        })
    })

    // @onmounted 首屏加载第 1 页
    onMounted(() => {
        void loadFirstPage()
    })

    // @onunmounted 反注册
    onUnmounted(() => {
        paging.unregister(handle)
    })

    return {
        columnTasks,
        total,
        isDone,
        loadingFirst,
        loadingMore,
        error,
        loadMore,
        fetchTasks: () => loadFirstPage()
    }
}

export default useKanbanColumn