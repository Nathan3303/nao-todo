import type { Reactive } from 'vue'
import type { Tag, Todo, TodoColumnOptions, GetTodosSortOptions } from '@nao-todo/types'

type TodoTableProps = {
    todos: Todo[]
    tags: Tag[]
    simple?: boolean
    emptyMessage?: string
    sortOptions: GetTodosSortOptions
    columnOptions: TodoColumnOptions
    useDeletedLine?: boolean
}

type TodoTableMultiSelectPayload = {
    selectedIds: Todo['id'][]
    selectRange: { start: number; end: number; original: number }
}

type TodoTableEmits = {
    (event: 'deleteTodo', id: Todo['id']): void
    (event: 'restoreTodo', id: Todo['id']): void
    (event: 'showTodoDetails', id: Todo['id']): void
    (event: 'sortTodo', payload: GetTodosSortOptions): void
    (event: 'multiSelect', payload: TodoTableMultiSelectPayload): void
}

type TodoTableContext = {
    showDetailsHandler: (id: Todo['id'], idx: number) => void
    sortOptions: Reactive<GetTodosSortOptions>
}

export type { TodoTableProps, TodoTableEmits, TodoTableContext, TodoTableMultiSelectPayload }
