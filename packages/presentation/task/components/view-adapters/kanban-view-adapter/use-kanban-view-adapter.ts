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

    /** 新增任务 ID：换值 ⇒ 看板只向目标列置顶插入（保页） */
    const newTaskId = ref<TaskViewObject['id'] | undefined>(undefined)

    /** 列内聚合摘要（外层空态 / 错误态判据，R-N） */
    const summary = ref<KanbanColumnSummary>({ settled: false, total: 0, firstError: '' })

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

    /** 重试（整页错误态）：让各列重新拉第 1 页 */
    const handleRetry = () => {
        refreshToken.value += 1
    }

    /** `RefreshData` ⇒ 各列回第 1 页 */
    const handleRefreshData = () => {
        refreshToken.value += 1
    }

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