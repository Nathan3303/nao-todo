import type { Columns } from '@nao-todo/components'
import type { TodoFilter } from '@/stores'
import type { TodoCreateDialogArgs } from '@nao-todo/components/todo/create-dialog/types'

export type ContentTableProps = {
    filterInfo: TodoFilter
    baseRoute: string
    columns?: Columns
    // projectId: Project['id']
    disabledCreateTodo?: boolean
}

export type ContentTableEmits = {
    (event: 'createTodo', todoName: string): void
    (event: 'createTodoByDialog', caller: (args: TodoCreateDialogArgs) => void): void
}
