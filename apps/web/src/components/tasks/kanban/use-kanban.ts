import { computed, provide, reactive } from 'vue'
import useKanbanDragger from './use-kanban-dragger'
import { KANBAN_GROUP_BY_NAMES, KANBAN_DEFAULT_GROUP_BY } from './constants'
import type { TaskKanbanVO, TaskKanbanProps, TaskKanbanEmits, TaskKanbanContext } from './types'

export const TASK_KANBAN_CONTEXT_KEY = Symbol('TASK_KANBAN_CONTEXT_KEY')

const useKanban = (props: TaskKanbanProps, emit: TaskKanbanEmits) => {
    // @hook 看板拖拽 Hook
    const { handleDragStart, handleDragOver, handleDragEnter, handleDragEnd, handleDrop } =
        useKanbanDragger()

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

    // @provide
    provide<TaskKanbanContext>(TASK_KANBAN_CONTEXT_KEY, {
        emit,
        tags: computed(() => props.tags),
        getProjectName: props.projectNameGetter,
        getColumnLabel: props.columnLabelGetter
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
