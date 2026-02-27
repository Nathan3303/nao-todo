import type { CommentHandler } from '@/handlers/tasks/comment-handler'
import type { EventHandler } from '@/handlers/tasks/event-handler'
import type { TaskHandler } from '@/handlers/tasks/task-handler'
import type {
    CreateEvent,
    Event,
    Project,
    Tag,
    Task,
    UpdateEvents,
    UpdateEvent,
    UpdateTaskOptions,
    WithNull
} from '@nao-todo/types'
import type { Comment, CreateComment, UpdateComment } from '@nao-todo/types/viewobjects/comment'
import type { ComputedRef, Ref } from 'vue'

/**
 * Task Details
 */

export type TaskDetailsViewObject = {
    id: string
    projectId: Project['id']
    projectName?: Project['name']
    name: string
    description: string
    state: 'todo' | 'in-progress' | 'done'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    tags: Tag['id'][]
    tagList: Tag[]
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
    taskId?: Task['id']
}

export type TaskDetailsEmits = {
    (e: 'closeDetails'): void
    (e: 'updateTask', taskId: Task['id'], update: UpdateTaskOptions): void
    (e: 'deleteTask', taskId: Task['id']): void
    (e: 'restoreTask', taskId: Task['id']): void
    (e: 'duplicateTask', taskId: Task['id']): void
    (e: 'createEvent', create: CreateEvent): void
    (e: 'updateEvent', eventId: Event['id'], update: UpdateEvent): void
    (e: 'updateEvents', updates: UpdateEvents[]): void
    (e: 'deleteEvent', eventId: Event['id']): void
    (e: 'createComment', create: CreateComment): void
    (e: 'updateComment', commentId: Comment['id'], update: UpdateComment): void
    (e: 'deleteComment', commentId: Comment['id']): void
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
    events: Ref<WithNull<Event[]>>
    eventProgress: ComputedRef<{ percentage: number; text: string }>
    comments: Ref<WithNull<Comment[]>>
    isCommenting: Ref<boolean>
    resortEvents: (oldEid: Event['id'], newEid: Event['id'], isUp: boolean) => void
    eventHandler: EventHandler
    commentHandler: CommentHandler
    taskHandler: TaskHandler
    tags: Ref<Tag[]>
}

/**
 * Task Details Footer
 */

export type TaskDetailsFooterContext = {
    emit: TaskDetailsEmits
    vo: ComputedRef<WithNull<TaskDetailsViewObject>>
    projects: ComputedRef<Project[]>
    isCommenting: Ref<boolean>
}

