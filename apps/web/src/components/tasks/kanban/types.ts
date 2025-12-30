import type { TaskApp } from '@nao-todo/application/task'
import type { GetTasksSortOptions, TagVO, TaskColumnOptions, TaskVO } from '@nao-todo/types'
import type { ComputedRef } from 'vue'

/**
 * Task Kanban
 */

export type TaskKanbanVO = {
    currentGroupBy: 'state' | 'priority'
    kanbanColumns: string[]
}

export type TaskKanbanProps = {
    tags: TagVO[]
    columns: TaskColumnOptions
    sortOptions: GetTasksSortOptions
    taskLister: TaskApp['list']
    columnLabelGetter: (key: string) => string
    projectNameGetter: (projectId: TaskVO['projectId']) => string
}

export type TaskKanbanEmits = {
    (e: 'showTaskDetails', taskId: TaskVO['id']): void
    (e: 'updateColumns', key: string, value: boolean): void
    (e: 'updateSortOptions', newSortOptions: GetTasksSortOptions): void
    (e: 'clearSortOptions'): void
    (e: 'deleteTask', taskId: TaskVO['id']): void
    (e: 'restoreTask', taskId: TaskVO['id']): void
    (e: 'finishTask', taskId: TaskVO['id']): void
    (e: 'unfinishTask', taskId: TaskVO['id']): void
}

export type TaskKanbanContext = {
    emit: TaskKanbanEmits
    tags: ComputedRef<TagVO[]>
    getProjectName: TaskKanbanProps['projectNameGetter']
    getColumnLabel: TaskKanbanProps['columnLabelGetter']
}

/**
 * Task Kanban Column
 */

// export type TaskKanbanColumnVO = {}

export type TaskKanbanColumnProps = {
    category: string
    columns: TaskColumnOptions
    disabled?: boolean
    displayable?: boolean
    taskLister: TaskApp['list']
}

// export type TodoKanbanColumnEmits = TodoKanbanEmits & {
//     (event: 'heart-todo', todoId: Todo['id']): void
//     (event: 'load-more'): void
//     (event: 'filter-todos-by-category', category: string): void
// }

/**
 * Task Kanban Column Item
 */

export type TaskKanbanColumnItemProps = {
    task: TaskVO
    tags: TagVO[]
    actived?: boolean
    columns?: TaskColumnOptions
}

export type TaskKanbanColumnItemEmits = {
    (event: 'click', taskId: TaskVO['id']): void
    (event: 'delete', taskId: TaskVO['id']): void
    (event: 'restore', taskId: TaskVO['id']): void
    (event: 'finish', taskId: TaskVO['id']): void
    (event: 'unfinish', taskId: TaskVO['id']): void
    (event: 'heart', taskId: TaskVO['id']): void
}
