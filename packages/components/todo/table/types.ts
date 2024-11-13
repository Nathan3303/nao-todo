import type { Reactive } from 'vue'
import type { Tag, Todo, TodoColumnOptions, GetTodosSortOptions } from '@nao-todo/types'

export type Columns = TodoColumnOptions

export type ColumnsKeys = keyof TodoColumnOptions

export type OrderInfo = {
    column: ColumnsKeys
    direction: 'asc' | 'desc'
}

export type TodoTableProps = {
    todos: Todo[]
    tags: Tag[]
    columns: TodoColumnOptions
    simple?: boolean
    emptyMessage?: string
    sortInfo: GetTodosSortOptions
}

export type TodoTableMultiSelectEmitPayload = {
    selectedIds: Todo['id'][]
    selectRange: { start: number; end: number }
}

export type TodoTableEmits = {
    (event: 'deleteTodo', id: Todo['id']): void
    (event: 'restoreTodo', id: Todo['id']): void
    (event: 'showTodoDetails', id: Todo['id']): void
    (event: 'sortTodo', sortInfo: GetTodosSortOptions): void
    (event: 'multiSelect', payload: TodoTableMultiSelectEmitPayload): void
}

export type TodoTableContext = {
    // todos: Todo[]
    // columns: Columns
    // deleteHandler: (id: Todo['id']) => void
    showDetailsHandler: (id: Todo['id'], idx: number) => void
    sortInfo: Reactive<GetTodosSortOptions>
}
