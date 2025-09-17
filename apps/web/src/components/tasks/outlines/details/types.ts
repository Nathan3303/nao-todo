import type { Project, Todo } from '@nao-todo/types'

export type DetailsHeaderProps = {
    shadowTodo?: Todo
    disableClose?: boolean
}

export type DetailsHeaderEmits = {
    (e: 'finishTodo'): void
    (e: 'updateTodoEndAt', value: string | null): void
    (e: 'close'): void
}

export type DetailsMainProps = {
    shadowTodo?: Todo
    eventsProgress: { percentage: number; text: string }
    commentsCount: number
    isCommenting: boolean
    leaveCommentHandler: (content: string) => Promise<boolean>
}

export type DetailsMainEmits = {
    (e: 'updateTodoState', newState: Todo['state']): void
    (e: 'updateTodoPriority', newPriority: Todo['priority']): void
    (e: 'update'): void
    (e: 'updateTodoTags', newTags: Todo['tags']): void
    (e: 'cancelLeaveComment'): void
}

export type DetailsFooterProps = {
    shadowTodo?: Todo
}

export type DetailsFooterEmits = {
    (
        e: 'updateTodoProject',
        newProjectId: Todo['projectId'],
        newProjectTitle: Project['title']
    ): void
    (e: 'leaveTodoComment'): void
    (e: 'duplicateTodo'): void
    (e: 'deleteTodoPermanently'): void
    (e: 'deleteTodo'): void
    (e: 'restoreTodo'): void
    (e: 'giveUpTodo'): void
    (e: 'cancelGiveUpTodo'): void
}

export type DetailsMainEventsProps = {
    todoId: Todo['id']
    loading?: boolean
}

export type UnusedTagOption = {
    label: string
    value: string
}

export type DetailsMainTagsProps = {
    todoId: Todo['id']
    todoTags: Todo['tags']
}

export type DetailsMainTagsEmits = {
    (event: 'updateTags', tags: Todo['tags']): void
}
