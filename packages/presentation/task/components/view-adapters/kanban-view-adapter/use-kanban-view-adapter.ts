import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useTasksStore } from '../../../stores'
import type { KanbanViewAdapterProps } from './types'
import type { TaskViewObject } from '@nao-todo/domain-task'
import type { KanbanColumnSummary } from '../../kanban/use-kanban-column-paging'

/**
 * 看板视图适配器 Hook
 *
 * @description `DEF-126`（ADR `docs/adr/2026-11-01-kanban-column-paging.md` 决策 2）：
 *              **删除**全局 `taskLoader` —— 分页下沉到列内（每列自持 loader）。
 *              本层不再承担 loading / 数据装载，只承担三件事：
 *                ① 把页面契约（筛选 / 排序 / 取任务 / 刷新计数 / 新增任务 ID）转交看板；
 *                ② 把 `RefreshData` / `AddNewTaskId` 两个全局事件翻译成看板的**命令**；
 *                ③ 收看板的**聚合摘要**（`summaryChange`）给外层 `loading-error` 判空 / 判错（R-N）。
 * @param props 看板视图适配器 props
 */
const useKanbanViewAdapter = (props: KanbanViewAdapterProps) => {
    /**
     * 任务存储
     * @description 列内只持任务 ID ⇒ 渲染时按 ID 取视图对象；`taskUseCase.list` 会把结果写进 store
     */
    const tasksStore = useTasksStore()

    /** 刷新计数：递增 ⇒ 各列回第 1 页（`RefreshData`） */
    const refreshToken = ref(0)

    /**
     * 本次 `refreshToken` 递增是否为**原地刷新**（`RefreshData`）
     * @description 同步拉取落库后的刷新 ⇒ `silent`（列内不置 loading、不插列底加载条、
     *              空列占位不换）；用户「重试」⇒ 非 silent（必须可见 loading，AC-K2）。
     */
    const refreshSilent = ref(false)

    /** 新增任务 ID：换值 ⇒ 看板只向目标列置顶插入（保页） */
    const newTaskId = ref<TaskViewObject['id'] | undefined>(undefined)

    /** 列内聚合摘要（外层空态 / 错误态判据，R-N） */
    const summary = ref<KanbanColumnSummary>({
        settled: false,
        total: 0,
        firstError: '',
        firstRefreshError: ''
    })

    /**
     * 按 ID 取任务视图对象
     * @param taskId 任务 ID
     */
    const getTask = (taskId: TaskViewObject['id']) => tasksStore.getTask(taskId)

    /**
     * 排序选项代理
     * @description 与列表 / 表格一致，默认按创建时间降序
     */
    const sortOptions = computed(
        () => props.getTasksOptions.sort || { field: 'createdAt', order: 'desc' }
    )

    /** 空状态信息 */
    const noTaskError = computed(() => props.getNoTaskError())

    /**
     * 整页空态
     * @description `settled && total === 0`（R-N）：所有列都加载完且确实一条都没有 ⇒
     *              结构性消灭「外层说没任务、列内还在加载」
     */
    const empty = computed(
        () => summary.value.settled && summary.value.total === 0 && Boolean(noTaskError.value)
    )

    /**
     * 整页错误态
     * @description `settled && total === 0 && firstError`（R-N）：有数据就不整页报错，错误留在列内
     */
    const error = computed(
        () =>
            summary.value.settled && summary.value.total === 0 && Boolean(summary.value.firstError)
    )

    /** 收列内聚合摘要 */
    const handleSummaryChange = (next: KanbanColumnSummary) => {
        summary.value = next
    }

    /**
     * 重试（整页错误态）：让各列重新拉第 1 页（**可见 loading**，不得静默）
     * @description 错误态下 `loading-error` 只渲染错误分支 ⇒ 看板（含各列）**已卸载**，
     *              此时仅递增 `refreshToken` 无人消费（各列句柄已反注册）⇒ 必须先把聚合摘要复位
     *              让外层离开错误态、看板重新挂载；各列 `onMounted` 走**非 silent** 拉取（AC-K2）。
     */
    const handleRetry = () => {
        summary.value = { settled: false, total: 0, firstError: '', firstRefreshError: '' }
        refreshSilent.value = false
        refreshToken.value += 1
    }

    /** `RefreshData` ⇒ 各列回第 1 页（**原地刷新**：`DEF-144` / AC-K1） */
    const handleRefreshData = () => {
        refreshSilent.value = true
        refreshToken.value += 1
    }

    /**
     * 列级「原地刷新失败」提示（`DEF-148`，非阻塞）
     * @description 只有**有内容**时才用提示条：无内容（首进即失败）仍走既有整页错误分支（AC-E4）
     */
    const refreshWarning = computed(() =>
        summary.value.total > 0 ? summary.value.firstRefreshError : ''
    )

    /** `AddNewTaskId` ⇒ 交给看板做「目标列置顶插入」 */
    const handleAddNewTaskId = (taskId: TaskViewObject['id']) => {
        newTaskId.value = taskId
    }

    onMounted(() => {
        props.subscriber.subscribe('RefreshData', handleRefreshData)
        props.subscriber.subscribe('AddNewTaskId', handleAddNewTaskId)
    })

    onUnmounted(() => {
        props.subscriber.unsubscribe('RefreshData', handleRefreshData)
        props.subscriber.unsubscribe('AddNewTaskId', handleAddNewTaskId)
    })

    return {
        sortOptions,
        refreshToken,
        refreshSilent,
        refreshWarning,
        newTaskId,
        getTask,
        empty,
        error,
        noTaskError,
        handleSummaryChange,
        handleRetry,
        viewProps: computed(() => ({
            preference: {
                columns: props.columns,
                getTodosOptions: props.getTasksOptions
            }
        }))
    }
}

export default useKanbanViewAdapter