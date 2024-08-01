import type { Columns } from '@/components'
import type { TodoFilter } from '@/stores'

export type ContentTableProps = {
    filterInfo: TodoFilter
    baseRoute: string
    columns?: Columns
}

export type ContentTableEmits = {
    (event: 'createTodo', todoName: string): void
}
