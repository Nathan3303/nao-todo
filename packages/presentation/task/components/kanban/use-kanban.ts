import { computed, onMounted, onUnmounted, provide, reactive, ref, watch } from 'vue'
import useKanbanDragger from './use-kanban-dragger'
import { useKanbanGroup } from './use-kanban-group'
import { KANBAN_GROUP_BY_NAMES, normalizeKanbanPriority } from './constants'
import { KANBAN_COLUMN_PAGING_KEY, useKanbanColumnPaging } from './use-kanban-column-paging'
import type { TaskKanbanProps, TaskKanbanEmits, TaskKanbanContext } from './types'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { type TaskColumnOptions, type GetTasksSortOptions } from '@nao-todo/shared/constants'
import { useMinuteTask } from '@nao-todo/shared/hooks'
import { notifyTaskError } from '../../utils/error-message'

export const TASK_KANBAN_CONTEXT_KEY = Symbol('TASK_KANBAN_CONTEXT_KEY')

const useKanban = (props: TaskKanbanProps, emit: TaskKanbanEmits) => {
    // @state 正在更新的任务 ID 集合
    const updatingTaskIds = reactive<Set<TaskViewObject['id']>>(new Set())

    // @states 分组状态由页面 Provider 供给（单一来源；不持久化 —— PRD R7/R-C）
    const groupBy = useKanbanGroup()

    // @computed 看板列集合（唯一来源 = `KANBAN_GROUP_BY_NAMES`，随分组状态派生）
    const kanbanColumns = computed(() => KANBAN_GROUP_BY_NAMES[groupBy.value] || [])

    // @hook 列注册表：列内分页的唯一编排入口（ADR 决策 1）
    const paging = useKanbanColumnPaging()

    /**
     * 任务所属列（当前分组维度下的列名）
     * @description 与写路径同源（R-F）：`state` 分组用 `state`、`priority` 分组用 `priority`（脏值归「低」）
     */
    const categoryOf = (task: TaskViewObject): string =>
        groupBy.value === 'priority' ? normalizeKanbanPriority(task.priority) : task.state

    // @method 处理拖拽放下 - 按当前分组写对应字段（state ⇒ 状态，priority ⇒ 优先级；R2 绝不交叉写）
    const handleTaskDrop = async (taskId: TaskViewObject['id'], category: string) => {
        const task = props.getTask(taskId)
        if (!task) return
        const byPriority = groupBy.value === 'priority'
        const current = categoryOf(task)
        // 归类后同档 ⇒ 无需写库（脏值卡已在「低」列时拖到「低」也不写）
        if (current === category) return
        // 只有真拖拽落列时才写入合法档位（读取归类不写库；R3）
        const payload = byPriority ? { priority: category } : { state: category }
        updatingTaskIds.add(taskId)
        try {
            const err = await props.taskUseCase.update(taskId, payload)
            if (err !== null) {
                notifyTaskError('task.updateFailed', err)
                return
            }
            // 写成功后只做本地增量（R-M）：源列 -1 且待补拉、目标列置顶 +1 ⇒ 不重查、不塌页
            paging.moveTask(taskId, current, category)
        } finally {
            updatingTaskIds.delete(taskId)
        }
    }

    // @hook 看板拖拽 Hook
    const { handleDragStart, handleDragOver, handleDragEnter, handleDragEnd, handleDrop } =
        useKanbanDragger(handleTaskDrop)

    // @hook 刷新 key
    const refreshKey = ref(1)
    const { run: startRefreshKeyIncrement, stop: stopRefreshKeyIncrement } = useMinuteTask(
        () => (refreshKey.value += 1)
    )

    // @watch 重置规则（R-C）：刷新 / 筛选变化 / 排序变化 ⇒ 各列回第 1 页
    // `refreshSilent`（`RefreshData` 触发的刷新）⇒ 原地刷新：不置 loading、不插列底加载条、
    //   空列占位不换（`DEF-144` 看板落点，AC-K1）；筛选 / 排序变化仍走非 silent（AC-K2）
    watch(
        () => props.refreshToken,
        () => void paging.resetAll({ silent: props.refreshSilent === true })
    )
    watch(
        () => props.getTasksOptions,
        () => void paging.resetAll(),
        { deep: true }
    )
    watch(
        () => props.sortOptions,
        () => void paging.resetAll(),
        { deep: true }
    )

    // @watch 新增任务（`AddNewTaskId`）：只向目标列置顶插入（保页，R-M/D2）
    watch(
        () => props.newTaskId,
        (taskId) => {
            if (!taskId) return
            const task = props.getTask(taskId)
            if (!task) return
            paging.insertTask(categoryOf(task), taskId)
        }
    )

    // @watch 列内分页聚合摘要 ⇒ 外层空态 / 错误态判据（R-N）
    watch(paging.summary, (summary) => emit('summaryChange', summary), { immediate: true })

    // @method 显示任务详情
    const showTaskDetails = (taskId: TaskViewObject['id']) => {
        emit('showTaskDetails', taskId)
    }

    // @method 删除任务
    const deleteTask = (taskId: TaskViewObject['id']) => {
        emit('deleteTask', taskId)
    }

    // @method 恢复任务
    const restoreTask = (taskId: TaskViewObject['id']) => {
        emit('restoreTask', taskId)
    }

    // @method 完成任务
    const finishTask = (taskId: TaskViewObject['id']) => {
        emit('finishTask', taskId)
    }

    // @method 取消完成任务
    const unfinishTask = (taskId: TaskViewObject['id']) => {
        emit('unfinishTask', taskId)
    }

    // @method 删除或恢复任务
    const deleteOrRestore = (taskId: TaskViewObject['id'], isDeleted: boolean) => {
        if (isDeleted) {
            restoreTask(taskId)
        } else {
            deleteTask(taskId)
        }
    }

    // @method 更新列显示
    const updateColumns = (key: keyof TaskColumnOptions, value: boolean) => {
        emit('updateColumns', key, value)
    }

    // @method 更新排序选项
    const updateSortOptions = (
        field: GetTasksSortOptions['field'],
        order: GetTasksSortOptions['order']
    ) => {
        emit('updateSortOptions', field, order)
    }

    // @method 清除排序选项
    const clearSortOptions = () => {
        emit('clearSortOptions')
    }

    // @onmounted
    onMounted(() => {
        startRefreshKeyIncrement()
    })

    // @onunmounted
    onUnmounted(() => {
        stopRefreshKeyIncrement()
    })

    // @provide
    provide<TaskKanbanContext>(TASK_KANBAN_CONTEXT_KEY, {
        emit,
        tags: computed(() => props.tags),
        columns: computed(() => props.columns),
        sortOptions: computed(() => props.sortOptions),
        getProjectName: props.projectNameGetter,
        getColumnLabel: props.columnLabelGetter,
        showTaskDetails,
        deleteTask,
        restoreTask,
        finishTask,
        unfinishTask,
        deleteOrRestore,
        updateColumns,
        updateSortOptions,
        clearSortOptions,
        updatingTaskIds: computed(() => updatingTaskIds),
        refreshKey,
        taskUseCase: props.taskUseCase,
        getTasksOptions: computed(() => props.getTasksOptions),
        getTask: props.getTask,
        paging
    })

    // @provide 列注册表（与 context 分开注入：列只关心分页编排，ADR 决策 1）
    provide(KANBAN_COLUMN_PAGING_KEY, paging)

    // @returns
    return {
        groupBy,
        kanbanColumns,
        // 看板拖拽 Hooks
        handleDragStart,
        handleDragOver,
        handleDragEnter,
        handleDragEnd,
        handleDrop
    }
}

export default useKanban