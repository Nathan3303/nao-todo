import type { TodoCreateDialogArgs } from '@/components/todo/create-dialog/types'
import type { Todo, TodoFilter } from '@/stores'
import type { ComputedRef } from 'vue'

export type TasksBasicViewContentType = {
    title: string
    description: string
    default: {
        viewType: 'table' | 'kanban'
        filterInfo: TodoFilter
    }
}

export type TasksBasicViewHandlersType = {
    handleCreateTodo: (todoName: Todo['name']) => any
    handleCreateTodoByDialog: (caller: (args: TodoCreateDialogArgs) => void) => any
}

export type TasksBasicViewHandlers = Record<string, TasksBasicViewHandlersType>

export type TasksBasicViewContext = {
    viewContent: ComputedRef<TasksBasicViewContentType>
    viewHandlers: ComputedRef<TasksBasicViewHandlersType>
}
