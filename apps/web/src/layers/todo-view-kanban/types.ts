import type { Columns } from '@nao-todo/components'
import type { TodoCreateDialogArgs } from '@nao-todo/components/todo/create-dialog/types'
import type { TodoFilter } from '@/stores'

export type ContentKanbanProps = {
    filterInfo: TodoFilter
    baseRoute: string
    columns?: Columns
    disabledCreateTodo?: boolean
}

export type ContentKanbanEmits = {
    (event: 'createTodo', newTodoName: string): void
    // (event: 'createTodo', todoName: string): void
    (event: 'createTodoByDialog', caller: (args: TodoCreateDialogArgs) => void): void
}
