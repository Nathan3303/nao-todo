import type { Todo, UpdateTodoOptions } from '@nao-todo/types'

export type DetailsEmits = {
    (e: 'close'): void
}

export type DetailsHeaderProps = {
    shadowTodo?: Todo
    disableClose?: boolean
    updating?: boolean
}

export type DetailsHeaderEmits = {
    (e: 'finishTodo'): void
    (e: 'updateTodoEndAt', value: string | null): void
    (e: 'close'): void
    (e: 'save'): void
}

export type DetailsMainProps = {
    shadowTodo?: Todo
    eventsProgress: { percentage: number; text: string }
    commentsCount: number
    isCommenting: boolean
    leaveCommentHandler: (content: string) => Promise<boolean>
    statusText: string
}

export type DetailsMainEmits = {
    (e: 'updateTodoState', newState: Todo['state']): void
    (e: 'updateTodoPriority', newPriority: Todo['priority']): void
    (e: 'update', key: keyof UpdateTodoOptions): void
    (e: 'updateTodoTags', newTags: Todo['tags']): void
    (e: 'cancelLeaveComment'): void
}

export type DetailsFooterProps = {
    shadowTodo?: Todo
}

export type DetailsFooterEmits = {
    (e: 'updateTodoProject', newProjectId: Todo['projectId']): void
    (e: 'deleteTodoPermanently', todoId: Todo['id']): void
    (e: 'deleteTodo', todoId: Todo['id']): void
    (e: 'restoreTodo', todoId: Todo['id']): void
    (e: 'giveUpTodo'): void
    (e: 'cancelGiveUpTodo'): void
    (e: 'leaveTodoComment'): void
    (e: 'duplicateTodo', todoId: Todo['id']): void
}

export type DetailsMainEventsProps = {
    // todoId: Todo['id']
    loading?: boolean
}

export type UnusedTagOption = {
    label: string
    value: string
}

export type DetailsMainTagsProps = {
    // todoId: Todo['id']
    todoTags: Todo['tags']
}

export type DetailsMainTagsEmits = {
    (event: 'updateTags', tags: Todo['tags']): void
}
