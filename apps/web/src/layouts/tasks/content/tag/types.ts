import type { ComputedRef } from 'vue'
import type { TagPreferenceVO, TagVO, TaskVO, WithNull } from '@nao-todo/types'
import type { TaskHandlers } from '@/infrastructure/hooks/tasks-view/use-task-handlers'
import type { Subscriber } from '@/infrastructure/hooks/use-subscriber'
import type { TagHandlers } from '@/infrastructure/hooks/tasks-view/use-tag-handlers'

export type TagViewVO = {
    tag: WithNull<TagVO>
    preference: WithNull<TagPreferenceVO>
    loading: boolean
    error: { message: string; errorImage: string }
}

export type TagViewProps = {
    tagId?: string
    taskId?: string
}

// export type TagViewEmits = {}

export type TagViewContext = {
    tag: ComputedRef<TagVO | null>
    preference: ComputedRef<WithNull<TagPreferenceVO>>
    tags: ComputedRef<TagVO[]>
    tasks: ComputedRef<TaskVO[]>
    tagHandlers: TagHandlers
    taskHandlers: TaskHandlers
    subscriber: Subscriber
    isHideCompletedAlready: ComputedRef<boolean>
    getColumnLabel: (key: string) => string
    getProjectName: (projectId: string) => string
    showTaskDetails: (taskId: TaskVO['id']) => void
    switchViewTypeToTable: () => void
    switchViewTypeToKanban: () => void
    switchViewTypeToList: () => void
    showTaskCreator: () => void
    switchHideCompleted: () => void
}
