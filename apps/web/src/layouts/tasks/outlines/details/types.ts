import type {
    CreateEventVO,
    EventVO,
    GoAsync,
    ProjectVO,
    TagVO,
    TaskVO,
    UpdateEventsVO,
    UpdateEventVO,
    UpdateTaskVO,
    WithNull
} from '@nao-todo/types'
import type { CommentVO, CreateCommentVO, UpdateCommentVO } from '@nao-todo/types/viewobjects/comment'
import type { ComputedRef, Ref } from 'vue'

/**
 * Task Details
 */

export type TaskDetailsVO = {
    id: string
    projectId: ProjectVO['id']
    projectName?: ProjectVO['name']
    name: string
    description: string
    state: 'todo' | 'in-progress' | 'done'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    tags: TagVO['id'][]
    tagList: TagVO[]
    startAt?: string | null
    endAt?: string | null
    deletedAt: string | null
    isDeleted: boolean
    isFavorited: boolean
    isGivenUp: boolean
    isDone: boolean
    createdAt: string
    updatedAt: string
}

export type TaskDetailsProps = {
    taskId?: TaskVO['id']
    projects: ProjectVO[]
    taskGetter: (taskId: TaskVO['id']) => TaskVO | undefined
    eventLister: (taskId: TaskVO['id']) => GoAsync<EventVO[]>
    commentLister: (taskId: TaskVO['id']) => GoAsync<CommentVO[]>
    projectNameGetter: (projectId: ProjectVO['id']) => string
    tagGetter: (tagIds: TagVO['id'][]) => TagVO[]
}

export type TaskDetailsEmits = {
    (e: 'closeDetails'): void
    (e: 'updateTask', taskId: TaskVO['id'], updateVO: UpdateTaskVO): void
    (e: 'deleteTask', taskId: TaskVO['id']): void
    (e: 'restoreTask', taskId: TaskVO['id']): void
    (e: 'duplicateTask', taskId: TaskVO['id']): void
    (e: 'createEvent', createVO: CreateEventVO): void
    (e: 'updateEvent', eventId: EventVO['id'], updateVO: UpdateEventVO): void
    (e: 'updateEvents', updatesVO: UpdateEventsVO[]): void
    (e: 'deleteEvent', eventId: EventVO['id']): void
    (e: 'createComment', createVO: CreateCommentVO): void
    (e: 'updateComment', commentId: CommentVO['id'], updateVO: UpdateCommentVO): void
    (e: 'deleteComment', commentId: CommentVO['id']): void
}

export type TaskDetailsContext = TaskDetailsHeaderContext &
    TaskDetailsMainContext &
    TaskDetailsFooterContext

/**
 * Task Details Header
 */

// export type TaskDetailsHeaderProps = {}

// export type TaskDetailsHeaderEmits = {}

export type TaskDetailsHeaderContext = {
    vo: Ref<WithNull<TaskDetailsVO>>
    finishTask: () => void
    closeDetails: () => void
    updateEndAt: (value: any) => void
}

/**
 * Task Details Main
 */

// export type TaskDetailsMainProps = {}

// export type TaskDetailsMainEmits = {}

export type TaskDetailsMainContext = {
    emit: TaskDetailsEmits
    vo: Ref<WithNull<TaskDetailsVO>>
    events: Ref<WithNull<EventVO[]>>
    eventProgress: ComputedRef<{ percentage: number; text: string }>
    comments: Ref<WithNull<CommentVO[]>>
    isCommenting: Ref<boolean>
    resortEvents: (oldIndex: number, newIndex: number, isUp: boolean) => void
    updateComment: (commentId: CommentVO['id'], updateVO: UpdateCommentVO) => void
    deleteComment: (commentId: CommentVO['id']) => void
}

/**
 * Task Details Footer
 */

// export type TaskDetailsFooterProps = {}

// export type TaskDetailsFooterEmits = {}

export type TaskDetailsFooterContext = {
    emit: TaskDetailsEmits
    vo: Ref<WithNull<TaskDetailsVO>>
    projects: ComputedRef<ProjectVO[]>
    isCommenting: Ref<boolean>
}
