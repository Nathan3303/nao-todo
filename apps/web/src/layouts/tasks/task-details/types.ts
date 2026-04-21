import type { CommentHandler } from '@/handlers/tasks/comment-handler'
import type { EventHandler } from '@/handlers/tasks/event-handler'
import type { TaskHandler } from '@/handlers/tasks/task-handler'
import type {
    CreateEventViewObject,
    EventViewObject,
    ProjectViewObject,
    TagViewObject,
    TaskViewObject,
    UpdateEventsViewObject,
    UpdateEventViewObject,
    UpdateTaskViewObject,
    WithNull,
    CommentViewObject,
    CreateCommentViewObject,
    UpdateCommentViewObject
} from '@nao-todo/types'
import type { ComputedRef, Ref } from 'vue'

/**
 * Task Details
 */

export type TaskDetailsViewObject = {
    id: string
    projectId: ProjectViewObject['id']
    projectName?: ProjectViewObject['name']
    name: string
    description: string
    state: string
    priority: string
    tags: TagViewObject['id'][]
    tagList: TagViewObject[]
    startAt?: string | null
    endAt?: string | null
    deletedAt: string | null
    isDeleted: boolean
    isStarMarked: boolean
    isGivenUp: boolean
    isDone: boolean
    createdAt: string
    updatedAt: string
}

export type TaskDetailsProps = {
    taskId?: TaskViewObject['id']
}

export type TaskDetailsEmits = {
    (e: 'closeDetails'): void
    (e: 'updateTask', taskId: TaskViewObject['id'], update: UpdateTaskViewObject): void
    (e: 'deleteTask', taskId: TaskViewObject['id']): void
    (e: 'restoreTask', taskId: TaskViewObject['id']): void
    (e: 'deleteTaskPermanently', taskId: TaskViewObject['id']): void
    (e: 'duplicateTask', taskId: TaskViewObject['id']): void
    (e: 'createEvent', create: CreateEventViewObject): void
    (e: 'updateEvent', eventId: EventViewObject['id'], update: UpdateEventViewObject): void
    (e: 'updateEvents', updates: UpdateEventsViewObject[]): void
    (e: 'deleteEvent', eventId: EventViewObject['id']): void
    (e: 'createComment', create: CreateCommentViewObject): void
    (e: 'updateComment', commentId: CommentViewObject['id'], update: UpdateCommentViewObject): void
    (e: 'deleteComment', commentId: CommentViewObject['id']): void
}

export type TaskDetailsContext = TaskDetailsHeaderContext &
    TaskDetailsMainContext &
    TaskDetailsFooterContext

/**
 * Task Details Header
 */

export type TaskDetailsHeaderContext = {
    vo: ComputedRef<WithNull<TaskDetailsViewObject>>
    closeDetails: () => void
}

/**
 * Task Details Main
 */

export type TaskDetailsMainContext = {
    emit: TaskDetailsEmits
    vo: ComputedRef<WithNull<TaskDetailsViewObject>>
    events: ComputedRef<EventViewObject[]>
    eventProgress: ComputedRef<{ percentage: number; text: string }>
    comments: ComputedRef<CommentViewObject[]>
    isCommenting: Ref<boolean>
    resortEvents: (
        oldEid: EventViewObject['id'],
        newEid: EventViewObject['id'],
        isUp: boolean
    ) => void
    eventHandler: EventHandler
    commentHandler: CommentHandler
    taskHandler: TaskHandler
    tags: Ref<TagViewObject[]>
    eventsLoading: ComputedRef<boolean>
    eventsError: ComputedRef<string>
    commentsLoading: ComputedRef<boolean>
    commentsError: ComputedRef<string>
    retryEvents: () => Promise<void>
    retryComments: () => Promise<void>
}

/**
 * Task Details Footer
 */

export type TaskDetailsFooterContext = {
    emit: TaskDetailsEmits
    vo: ComputedRef<WithNull<TaskDetailsViewObject>>
    projects: ComputedRef<ProjectViewObject[]>
    isCommenting: Ref<boolean>
}

