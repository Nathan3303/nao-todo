import type { Columns } from '@/components'
import type { TodoCreateDialogArgs } from '@/components/todo/create-dialog/types'
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
