// import type { InnerDropdownOptionVO } from '@/components/ui'
import type { ComputedRef } from 'vue'
import type { Tag, Task, BuiltInProjectPreference, BuiltInProject } from '@nao-todo/types'
// import type { BuiltInProjectHandlers } from '@/infrastructure/hooks/tasks-view/use-built-in-project-handlers'
// import type { TaskHandlers } from '@/infrastructure/hooks/tasks-view/use-task-handlers'
import type { Subscriber } from '@/infrastructure/hooks/use-subscriber'
import { BuiltInProjectLayoutHandlers } from '@nao-todo/application/web/handlers/built-in-project-layout'
import { TaskUseCase } from '@nao-todo/application/web/usecases/task'

export type BuiltInProjectViewProps = {
    projectId?: string
    taskId?: string
}

// export type BuiltInProjectViewEmits = {}

export type BuiltInProjectViewContext = {
    taskUseCase: TaskUseCase
    builtInProject: ComputedRef<BuiltInProject | undefined>
    preference: ComputedRef<BuiltInProjectPreference | undefined>
    tags: ComputedRef<Tag[]>
    // columnsDropdownOptions: ComputedRef<{ options: InnerDropdownOptionVO[]; count: number }>
    // taskHandlers: TaskHandlers
    builtInProjectHandlers: BuiltInProjectLayoutHandlers
    subscriber: Subscriber
    isHideCompletedAlready: ComputedRef<boolean>
    getColumnLabel: (key: string) => string
    getProjectName: (projectId: string) => string
    showTaskDetails: (taskId: Task['id']) => void
    switchViewTypeToTable: () => void
    switchViewTypeToKanban: () => void
    switchViewTypeToList: () => void
    showTaskCreator: () => void
    // switchHideCompleted: () => void
}
