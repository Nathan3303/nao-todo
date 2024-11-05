import type { Reactive } from 'vue'
import type { Tag, Todo, TodoColumnOptions, TodoSortOptions } from '@nao-todo/stores'

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
    sortInfo: TodoSortOptions
}

export type TodoTableMultiSelectEmitPayload = {
    selectedIds: Todo['id'][]
    selectRange: { start: number; end: number }
}

export type TodoTableEmits = {
    (event: 'deleteTodo', id: Todo['id']): void
    (event: 'restoreTodo', id: Todo['id']): void
    (event: 'showTodoDetails', id: Todo['id']): void
    (event: 'sortTodo', sortInfo: TodoSortOptions): void
    (event: 'multiSelect', payload: TodoTableMultiSelectEmitPayload): void
}

export type TodoTableContext = {
    // todos: Todo[]
    // columns: Columns
    // deleteHandler: (id: Todo['id']) => void
    showDetailsHandler: (id: Todo['id'], idx: number) => void
    sortInfo: Reactive<TodoSortOptions>
}
