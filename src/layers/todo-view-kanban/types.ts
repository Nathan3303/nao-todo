import type { Columns } from '@/components'
import type { TodoFilter } from '@/stores'

export type ContentKanbanProps = {
    filterInfo: TodoFilter
    baseRoute: string
    columns?: Columns
    disabledCreateTodo?: boolean
}

export type ContentKanbanEmits = {
    (event: 'createTodo', newTodoName: string): void
}
