// import type { InnerDropdownOptionVO } from '@/components/ui'
import type { ComputedRef } from 'vue'
import type { ProjectPreferenceVO, ProjectVO, TagVO, TaskVO, WithNull } from '@nao-todo/types'
import type { BuiltInProjectHandlers } from '@/infrastructure/hooks/tasks-view/use-built-in-project-handlers'
import type { TaskHandlers } from '@/infrastructure/hooks/tasks-view/use-task-handlers'
import type { Subscriber } from '@/infrastructure/hooks/use-subscriber'

export type BuiltInProjectViewVO = {
    project: WithNull<ProjectVO>
    preference: WithNull<ProjectPreferenceVO>
    loading: boolean
    error: { message: string; errorImage: string }
}

export type BuiltInProjectViewProps = {
    projectId?: string
    taskId?: string
}

// export type BuiltInProjectViewEmits = {}

export type BuiltInProjectViewContext = {
    project: ComputedRef<ProjectVO | null>
    preference: ComputedRef<WithNull<ProjectPreferenceVO>>
    tags: ComputedRef<TagVO[]>
    tasks: ComputedRef<TaskVO[]>
    // columnsDropdownOptions: ComputedRef<{ options: InnerDropdownOptionVO[]; count: number }>
    builtInProjectHandlers: BuiltInProjectHandlers
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
