import type { Reactive } from 'vue'
import type { Todo, TodoFilter, TodoSortOptions } from '@/stores'

export type Columns = {
    createdAt: boolean
    priority: boolean
    state: boolean
    description: boolean
    updatedAt: boolean
    startAt?: boolean
    endAt?: boolean
    project?: boolean
}

export type ColumnsKeys = keyof Columns

export type OrderInfo = {
    column: ColumnsKeys
    direction: 'asc' | 'desc'
}

export type TodoTableProps = {
    todos: Todo[]
    columns: Columns
    simple?: boolean
    emptyMessage?: string
    sortInfo: TodoSortOptions
}

export type TodoTableEmits = {
    (event: 'deleteTodo', id: Todo['id']): void
    (event: 'restoreTodo', id: Todo['id']): void
    (event: 'showTodoDetails', id: Todo['id']): void
    (event: 'sortTodo', sortInfo: TodoSortOptions): void
}

export type TodoTableContext = {
    // todos: Todo[]
    // columns: Columns
    // deleteHandler: (id: Todo['id']) => void
    showDetailsHandler: (id: Todo['id']) => void
    sortInfo: Reactive<TodoSortOptions>
}
