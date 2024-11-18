import type { TodoCreateDialogArgs } from '@/layers/create-todo-dialog/types'

export type ContentTableProps = {
    baseRoute: string
    disabledCreateTodo?: boolean
}

export type ContentTableEmits = {
    (event: 'createTodo', todoName: string): void
    (event: 'createTodoByDialog', caller: (args: TodoCreateDialogArgs) => void): void
}
