import type { TodoCreateDialogArgs } from '@nao-todo/components/todo/create-dialog/types'

export type ContentKanbanProps = {
    baseRoute: string
    disabledCreateTodo?: boolean
}

export type ContentKanbanEmits = {
    (event: 'createTodo', newTodoName: string): void
    (event: 'createTodoByDialog', caller: (args: TodoCreateDialogArgs) => void): void
}
