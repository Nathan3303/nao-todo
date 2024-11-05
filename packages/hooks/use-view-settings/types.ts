import type { TodoFilter, TodoSortOptions } from '@nao-todo/stores'
import type { Columns } from '@nao-todo/components'

export type ViewSettings = {
    type: 'table' | 'kanban'
    sortInfo: TodoSortOptions
    filterInfo: TodoFilter
    columns: Columns
}
