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
    // projects: Project[]
    // taskGetter: (taskId: Task['id']) => Task | undefined
    // eventLister: (taskId: Task['id']) => GoAsync<Event[]>
    // commentLister: (taskId: Task['id']) => GoAsync<Comment[]>
    // projectNameGetter: (projectId: Project['id']) => string
    // tagGetter: (tagIds: Tag['id'][]) => Tag[]
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

// export type TaskDetailsHeaderProps = {}

// export type TaskDetailsHeaderEmits = {}

export type TaskDetailsHeaderContext = {
    vo: Ref<WithNull<TaskDetailsViewObject>>
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
    vo: Ref<WithNull<TaskDetailsViewObject>>
    events: Ref<WithNull<Event[]>>
    eventProgress: ComputedRef<{ percentage: number; text: string }>
    comments: Ref<WithNull<Comment[]>>
    isCommenting: Ref<boolean>
    resortEvents: (oldIndex: number, newIndex: number, isUp: boolean) => void
    updateComment: (commentId: Comment['id'], update: UpdateComment) => void
    deleteComment: (commentId: Comment['id']) => void
}

/**
 * Task Details Footer
 */

// export type TaskDetailsFooterProps = {}

// export type TaskDetailsFooterEmits = {}

export type TaskDetailsFooterContext = {
    emit: TaskDetailsEmits
    vo: Ref<WithNull<TaskDetailsViewObject>>
    projects: ComputedRef<Project[]>
    isCommenting: Ref<boolean>
}

