import type { TaskTagViewObject, TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import type { GetTasksOptions, GetTasksSortOptions, TaskColumnOptions } from '@nao-todo/shared'
import type { ComputedRef, Ref } from 'vue'
import type { KanbanColumnPaging, KanbanColumnSummary } from './use-kanban-column-paging'

/**
 * Task Kanban
 */

export type TaskKanbanProps = {
    tags: TaskTagViewObject[]
    columns: TaskColumnOptions
    sortOptions: GetTasksSortOptions
    taskUseCase: TaskUseCase
    columnLabelGetter: (key: string) => string
    projectNameGetter: (projectId: TaskViewObject['projectId']) => string
    /**
     * 用户基础筛选（页面下发）
     * @description 列查询条件 = 本筛选 ∩ 列条件（PRD R-I）；筛选变化 ⇒ 各列回第 1 页
     */
    getTasksOptions: GetTasksOptions
    /**
     * 按 ID 取任务视图对象
     * @description 列内只持有任务 ID（`useTasksLoader` 的 `taskIds`），渲染时按 ID 解析
     *              ⇒ 拖拽 / 新增后无需整板重查（R-M）
     */
    getTask: (taskId: TaskViewObject['id']) => TaskViewObject | undefined
    /**
     * 刷新计数（`RefreshData` ⇒ 递增）
     * @description 递增 ⇒ 各列回第 1 页（R-C）；与 `refreshKey`（分钟级卡片重渲染）无关
     */
    refreshToken: number
    /**
     * 新增任务 ID（`AddNewTaskId` ⇒ 换新值）
     * @description 只向目标列**置顶插入**（保页），不重查整板（R-M/D2）
     */
    newTaskId?: TaskViewObject['id']
}

export type TaskKanbanEmits = {
    (e: 'showTaskDetails', taskId: TaskViewObject['id']): void
    (e: 'updateColumns', key: keyof TaskColumnOptions, value: boolean): void
    (
        e: 'updateSortOptions',
        field: GetTasksSortOptions['field'],
        order: GetTasksSortOptions['order']
    ): void
    (e: 'clearSortOptions'): void
    (e: 'deleteTask', taskId: TaskViewObject['id']): void
    (e: 'restoreTask', taskId: TaskViewObject['id']): void
    (e: 'finishTask', taskId: TaskViewObject['id']): void
    (e: 'unfinishTask', taskId: TaskViewObject['id']): void
    /** 列内分页聚合摘要（外层空态 / 错误态判据，R-N） */
    (e: 'summaryChange', summary: KanbanColumnSummary): void
}

export type TaskKanbanContext = {
    emit: TaskKanbanEmits
    tags: ComputedRef<TaskTagViewObject[]>
    columns: ComputedRef<TaskColumnOptions>
    sortOptions: ComputedRef<GetTasksSortOptions>
    getProjectName: TaskKanbanProps['projectNameGetter']
    getColumnLabel: TaskKanbanProps['columnLabelGetter']
    showTaskDetails: (taskId: TaskViewObject['id']) => void
    deleteTask: (taskId: TaskViewObject['id']) => void
    restoreTask: (taskId: TaskViewObject['id']) => void
    finishTask: (taskId: TaskViewObject['id']) => void
    unfinishTask: (taskId: TaskViewObject['id']) => void
    deleteOrRestore: (taskId: TaskViewObject['id'], isDeleted: boolean) => void
    updateColumns: (key: keyof TaskColumnOptions, value: boolean) => void
    updateSortOptions: (
        field: GetTasksSortOptions['field'],
        order: GetTasksSortOptions['order']
    ) => void
    clearSortOptions: () => void
    updatingTaskIds: ComputedRef<Set<TaskViewObject['id']>>
    refreshKey: Ref<number>
    /** 任务用例（列内 loader 的数据源，R-E：本地仓储） */
    taskUseCase: TaskUseCase
    /** 列查询基础筛选（求交用，R-I） */
    getTasksOptions: ComputedRef<GetTasksOptions>
    /** 按 ID 取任务视图对象（列内渲染解析） */
    getTask: TaskKanbanProps['getTask']
    /** 列注册表（唯一编排入口，ADR 决策 1） */
    paging: KanbanColumnPaging
}

/**
 * Task Kanban Column
 */

export type TaskKanbanColumnProps = {
    category: string
    /** 分组方式：`state` ⇒ 列 = 状态；`priority` ⇒ 列 = 优先级（PRD AC1b / R2） */
    groupBy: 'state' | 'priority'
    columns: TaskColumnOptions
    disabled?: boolean
    displayable?: boolean
}

/**
 * Task Kanban Column Item
 */

export type TaskKanbanColumnItemProps = {
    task: TaskViewObject
    tags: TaskTagViewObject[]
    actived?: boolean
    columns?: TaskColumnOptions
    isUpdating?: boolean
}

export type TaskKanbanColumnItemEmits = {
    (event: 'click', taskId: TaskViewObject['id']): void
    (event: 'delete', taskId: TaskViewObject['id']): void
    (event: 'restore', taskId: TaskViewObject['id']): void
    (event: 'finish', taskId: TaskViewObject['id']): void
    (event: 'unfinish', taskId: TaskViewObject['id']): void
    (event: 'heart', taskId: TaskViewObject['id']): void
}