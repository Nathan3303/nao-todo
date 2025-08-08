import type { ComputedRef, Reactive, Ref } from 'vue'
import type { Tag, Todo, TodoColumnOptions, GetTodosSortOptions } from '@nao-todo/types'

export type TodoTableProps = {
    todos: Todo[]
    tags: Tag[]
    simple?: boolean
    emptyMessage?: string
    sortOptions: GetTodosSortOptions
    columnOptions: TodoColumnOptions
    useDeletedLine?: boolean
}

export type TodoTableMultiSelectPayload = {
    selectedIds: Todo['id'][]
    selectRange: { start: number; end: number; original: number }
}

export type TodoTableEmits = {
    (event: 'deleteTodo', id: Todo['id']): void
    (event: 'restoreTodo', id: Todo['id']): void
    (event: 'showTodoDetails', id: Todo['id']): void
    (event: 'sortTodo', payload: GetTodosSortOptions): void
    (event: 'multiSelect', payload: TodoTableMultiSelectPayload): void
}

export type TodoTableContext = {
    columnOptions: ComputedRef<TodoColumnOptions>
    isOnMobile: Ref<boolean>
    sortOptions: ComputedRef<GetTodosSortOptions>
    todos: ComputedRef<Todo[]>
    selectRange: Reactive<TodoTableMultiSelectPayload['selectRange']>
    useDeletedLine: ComputedRef<boolean>
    tagBarClamped: ComputedRef<number>
    tags: ComputedRef<Tag[]>
    refreshKey: Ref<number>
    isTodoExpired: (todo: Todo) => boolean
    handleClearSortInfo: () => void
    handleShowDetails: (todoId: Todo['id'], idx: number) => void
    handleMultiSelect: (idx: number) => void
    getProjectNameByIdFromLocal: (projectId: string) => string | undefined
    handleDeleteBtnClk: (id: Todo['id'], isDeleted: boolean) => void
    handleUpdateSortOptions: (payload: GetTodosSortOptions) => void
}

export type TodoTableOrderButtonProps = {
    prop: GetTodosSortOptions['field']
    text?: string
}
