import type { Todo } from '@/stores'

export type Columns = {
    createdAt: boolean
    priority: boolean
    state: boolean
    description: boolean
    updatedAt: boolean
    startAt?: boolean
    endAt?: boolean
}

export type ColumnsKeys = keyof Columns

export type TodoTableProps = {
    todos: Todo[]
    columns: Columns
    simple?: boolean
}

export type TodoTableEmits = {
    (event: 'deleteTodo', id: Todo['id']): void
    (event: 'showTodoDetails', id: Todo['id']): void
}

export type TodoTableContext = {
    todos: Todo[]
    columns: Columns
    deleteHandler: (id: Todo['id']) => void
    showDetailsHandler: (id: Todo['id']) => void
}
