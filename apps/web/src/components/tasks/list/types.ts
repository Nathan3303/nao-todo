import type { ComputedRef, Reactive } from 'vue'
import type { Tag, Todo, TodoColumnOptions, GetTodosSortOptions } from '@nao-todo/types'

export type TodoListProps = {
    tags: Tag[]
    todos: Todo[]
    simple?: boolean
    columns: TodoColumnOptions
    sortOptions?: GetTodosSortOptions
    emptyMessage?: string
    useDeletedLine?: boolean
    extraGetOptions?: Record<string, any>
}

export type TodoListMultiSelectPayload = {
    selectedIds: Todo['id'][]
    selectRange: { start: number; end: number; original: number }
}

export type TodoListEmits = {
    (event: 'clearSortOptions'): void
    (event: 'deleteTodo', id: Todo['id']): void
    (event: 'restoreTodo', id: Todo['id']): void
    (event: 'showTodoDetails', id: Todo['id']): void
    (event: 'showMultiSelect', payload: TodoListMultiSelectPayload): void
    (event: 'updateSortOptions', newSortOptions: GetTodosSortOptions): void
}

export type TodoListContext = {
    tags: ComputedRef<Tag[]>
    todos: ComputedRef<Todo[]>
    columns: ComputedRef<TodoListProps['columns']>
    refreshKey: ComputedRef<number>
    selectRange: Reactive<TodoListMultiSelectPayload['selectRange']>
    sortOptions: ComputedRef<TodoListProps['sortOptions']>
    tagBarClamped: ComputedRef<number>
    getColumnText: (key: string, replaceText?: string) => string
    isTodoExpired: (todo: Todo) => boolean
    getProjectName: (projectId: Todo['projectId']) => string
    clearSortOptions: () => void
    updateSortOptions: (newSortOptions: GetTodosSortOptions) => void
    showTodoDetailsPanel: (todoId: Todo['id'], idx: number) => void
    showMultiSelectPanel: (idx: number) => void
    deleteButtonClickHandler: (todoId: Todo['id'], isDeleted: boolean) => void
}

export type TodoListOrderButtonProps = {
    prop: GetTodosSortOptions['field']
    text?: string
}
