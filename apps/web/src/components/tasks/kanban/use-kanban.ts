import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTasksDataStore } from '@/stores/tasks'
import useKanbanDragger from './use-kanban-dragger'
import { KANBAN_GROUP_BY_NAMES, KANBAN_DEFAULT_GROUP_BY } from './constants'
import type { TodoKanbanEmits } from './types'
import type { Todo } from '@nao-todo/types'

const useKanban = (emit: TodoKanbanEmits) => {
    // @stores 全局 stores
    const tasksDataStore = useTasksDataStore()

    // @hook 看板拖拽 Hook
    const { handleDragStart, handleDragOver, handleDragEnter, handleDragEnd, handleDrop } =
        useKanbanDragger()

    // @states 前置状态
    const { todos, tags } = storeToRefs(tasksDataStore)

    // @state 加载状态
    const loading = ref(true)

    // @state 看板分组列表
    const currentGroupBy = ref<'state' | 'priority'>(KANBAN_DEFAULT_GROUP_BY)
    const kanbanColumns = ref<string[]>([])

    // @method 获取分组列表
    const getKanbanColumns = (groupBy: 'state' | 'priority' = KANBAN_DEFAULT_GROUP_BY) => {
        // 清空 todos 列表
        tasksDataStore.clearTodos()
        // 更新分组方式
        currentGroupBy.value = groupBy
        // 获取分组列表
        loading.value = true
        kanbanColumns.value = KANBAN_GROUP_BY_NAMES[groupBy] || []
        loading.value = false
    }

    // @method 过滤待办任务
    const filterTodosByCategory = (category: string) => {
        // 过滤 todos 列表
        todos.value = todos.value.filter((todo) => todo[currentGroupBy.value] === category)
    }

    // @returns
    return {
        loading,
        kanbanColumns,
        todos,
        tags,
        getKanbanColumns,
        getProjectName: tasksDataStore.getProjectNameById,
        getTodosWithPush: tasksDataStore.getTodosWithPush,
        // emit 代理
        handleShowTodoDetails: (todoId: Todo['id']) => emit('show-todo-details', todoId),
        handleDeleteTodo: (todoId: Todo['id']) => emit('delete-todo', todoId),
        handleRestoreTodo: (todoId: Todo['id']) => emit('restore-todo', todoId),
        handleFinishTodo: (todoId: Todo['id']) => emit('finish-todo', todoId),
        handleUnfinishTodo: (todoId: Todo['id']) => emit('unfinish-todo', todoId),
        // 看板拖拽 Hooks
        handleDragStart,
        handleDragOver,
        handleDragEnter,
        handleDragEnd,
        handleDrop,
        // 移除分组待办任务列表
        filterTodosByCategory
    }
}

export default useKanban
