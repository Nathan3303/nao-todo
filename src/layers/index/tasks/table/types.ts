import type { Columns } from '@/components'
import type { TodoFilter } from '@/stores'
import type { TodoCreateDialogArgs } from '@/components/todo/create-dialog/types'

export type ContentTableProps = {
    filterInfo: TodoFilter
    baseRoute: string
    columns?: Columns
    // projectId: Project['id']
}

export type ContentTableEmits = {
    (event: 'createTodo', todoName: string): void
    (event: 'createTodoByDialog', caller: (args: TodoCreateDialogArgs) => void): void
}
