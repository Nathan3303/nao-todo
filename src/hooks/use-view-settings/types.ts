import type { TodoFilter, TodoSortOptions } from '@/stores'
import type { Columns } from '@/components'

export type ViewSettings = {
    type: 'table' | 'kanban'
    sortInfo: TodoSortOptions
    filterInfo: TodoFilter
    columns: Columns
}
