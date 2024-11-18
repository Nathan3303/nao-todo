import type { TodoCreateDialogArgs } from '@/layers/create-todo-dialog/types'

export type ContentKanbanProps = {
    baseRoute: string
    disabledCreateTodo?: boolean
}

export type ContentKanbanEmits = {
    (event: 'createTodo', newTodoName: string): void
    (event: 'createTodoByDialog', caller: (args: TodoCreateDialogArgs) => void): void
}
