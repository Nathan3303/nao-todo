import type { TodoCreateDialogArgs } from '@nao-todo/components/todo/create-dialog/types'
import type { Todo, TodoFilter } from '@nao-todo/stores'
import type { Ref } from 'vue'

export type BasicViewInfo = {
    title: string
    description: string
    default: {
        viewType: 'table' | 'kanban'
        filterInfo: TodoFilter
    }
    handleCreateTodo?: (todoName: Todo['name']) => any
    handleCreateTodoByDialog?: (caller: (args: TodoCreateDialogArgs) => void) => any
}

export type BasicViewContext = {
    viewInfo: Ref<BasicViewInfo>
}
