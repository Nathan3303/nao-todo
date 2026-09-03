import { computed, onMounted, onUnmounted, provide, reactive, ref } from 'vue'
import useKanbanDragger from './use-kanban-dragger'
import { KANBAN_GROUP_BY_NAMES, KANBAN_DEFAULT_GROUP_BY } from './constants'
import type { TaskKanbanVO, TaskKanbanProps, TaskKanbanEmits, TaskKanbanContext } from './types'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { type TaskColumnOptions, type GetTasksSortOptions, useMinuteTask } from '@nao-todo/shared'

export const TASK_KANBAN_CONTEXT_KEY = Symbol('TASK_KANBAN_CONTEXT_KEY')

const useKanban = (props: TaskKanbanProps, emit: TaskKanbanEmits) => {
    // @state 正在更新的任务 ID 集合
    const updatingTaskIds = reactive<Set<TaskViewObject['id']>>(new Set())

    // @method 处理拖拽放下 - 更新任务状态
    const handleTaskDrop = async (
        taskId: TaskViewObject['id'],
        category: TaskViewObject['state']
    ) => {
        const task = props.tasks.find((t) => t.id === taskId)
        if (task && task.state !== category) {
            updatingTaskIds.add(taskId)
            try {
                await props.taskUseCase.update(taskId, { state: category })
            } finally {
                updatingTaskIds.delete(taskId)
            }
        }
    }

    // @hook 看板拖拽 Hook
    const { handleDragStart, handleDragOver, handleDragEnter, handleDragEnd, handleDrop } =
        useKanbanDragger(handleTaskDrop)

    // @states
    const states = reactive<TaskKanbanVO>({
        currentGroupBy: KANBAN_DEFAULT_GROUP_BY,
        kanbanColumns: KANBAN_GROUP_BY_NAMES[KANBAN_DEFAULT_GROUP_BY] || []
    })

    // @method 获取分组列表
    const getKanbanColumns = (groupBy: 'state' | 'priority' = KANBAN_DEFAULT_GROUP_BY) => {
        // 更新分组方式
        states.currentGroupBy = groupBy
        // 获取分组列表
        states.kanbanColumns = KANBAN_GROUP_BY_NAMES[groupBy] || []
    }

    // @hook 刷新 key
    const refreshKey = ref(1)
    const { run: startRefreshKeyIncrement, stop: stopRefreshKeyIncrement } = useMinuteTask(
        () => (refreshKey.value += 1)
    )

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
        refreshKey
    })

    // @returns
    return {
        states,
        getKanbanColumns,
        // 看板拖拽 Hooks
        handleDragStart,
        handleDragOver,
        handleDragEnter,
        handleDragEnd,
        handleDrop
    }
}

export default useKanban