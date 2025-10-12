import type { ComputedRef, Reactive, Ref } from 'vue'
import type { Tag, Todo, TodoColumnOptions, GetTodosSortOptions } from '@nao-todo/types'

export type TodoTableProps = {
    todos: Todo[]
    tags: Tag[]
    simple?: boolean
    emptyMessage?: string
    sortOptions?: GetTodosSortOptions
    columnOptions: TodoColumnOptions
    useDeletedLine?: boolean
}

export type TodoTableMultiSelectPayload = {
    selectedIds: Todo['id'][]
    selectRange: { start: number; end: number; original: number }
}

export type TodoTableEmits = {
    // todo
    (event: 'deleteTodo', id: Todo['id']): void
    (event: 'restoreTodo', id: Todo['id']): void
    // panel
    (event: 'showTodoDetails', id: Todo['id']): void
    (event: 'showMultiSelect', payload: TodoTableMultiSelectPayload): void
    // sortOptions
    (event: 'clearSortOptions'): void
    (event: 'updateSortOptions', newSortOptions: GetTodosSortOptions): void
}

export type TodoTableContext = {
    // header
    columnOptions: ComputedRef<TodoTableProps['columnOptions']>
    sortOptions: ComputedRef<TodoTableProps['sortOptions']>
    clearSortOptions: () => void
    updateSortOptions: (newSortOptions: GetTodosSortOptions) => void
    isScrolling: Ref<boolean>
    // main
    todos: ComputedRef<Todo[]>
    tags: ComputedRef<Tag[]>
    tagBarClamped: ComputedRef<number>
    refreshKey: Ref<number>
    selectRange: Reactive<TodoTableMultiSelectPayload['selectRange']>
    isTodoExpired: (todo: Todo) => boolean
    showTodoDetailsPanel: (todoId: Todo['id'], idx: number) => void
    showMultiSelectPanel: (idx: number) => void
    getProjectNameByIdFromLocal: (projectId: string) => string | void
    deleteButtonClickHandler: (todoId: Todo['id'], isDeleted: boolean) => void
}

export type TodoTableOrderButtonProps = {
    prop: GetTodosSortOptions['field']
    text?: string
}
