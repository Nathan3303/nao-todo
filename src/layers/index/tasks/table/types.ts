import type { Columns } from '@/components'
import type { Project, TodoFilter } from '@/stores'

export type ContentTableProps = {
    filterInfo: TodoFilter
    baseRoute: string
    columns?: Columns
    // projectId: Project['id']
}

export type ContentTableEmits = {
    (event: 'createTodo', todoName: string): void
}
