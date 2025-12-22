import type {
    GetTasksSortOptions,
    ProjectVO,
    TagVO,
    TaskColumnOptions,
    TaskVO,
    WithNull
} from '@nao-todo/types'
import { type TasksProjectViewContext, TASKS_PROJECT_VIEW_CONTEXT_KEY } from '../use-project-view'
import { computed, inject, provide, type ComputedRef } from 'vue'

export type TasksProjectViewContentProps = {
    projectId?: string
    viewType?: string
    todoId?: string
}

export type TasksProjectViewContentContext = {
    projectId: ComputedRef<WithNull<ProjectVO['id']>>
    columns: ComputedRef<WithNull<TaskColumnOptions>>
    sortOptions: ComputedRef<WithNull<GetTasksSortOptions>>
    tags: ComputedRef<TagVO[]>
    tasks: ComputedRef<TaskVO[]>
    showTaskDetails: (taskId: TaskVO['id']) => void
    deleteTask: (taskId: TaskVO['id']) => void
    restoreTask: (taskId: TaskVO['id']) => void
    updateColumns: (key: string, value: boolean) => void
    updateSortOptions: (options: GetTasksSortOptions) => void
    getColumnLabel: (key: string) => string
    clearSortOptions: () => void
    getProjectName: (projectId: string) => string
}

export const TASKS_PROJECT_VIEW_CONTENT_CONTEXT_KEY = Symbol(
    'TASKS_PROJECT_VIEW_CONTENT_CONTEXT_KEY'
)

export default () => {
    // @context 任务清单视图上下文
    const viewContext = inject<TasksProjectViewContext>(TASKS_PROJECT_VIEW_CONTEXT_KEY)!

    // @method 显示任务详情面板
    const showTaskDetails = (taskId: TaskVO['id']) => {
        viewContext.showTaskDetails(taskId)
    }

    // @proxy
    const projectId = computed(() => viewContext.project.value?.id || null)
    const columns = computed(() => viewContext.preference.value?.columns || null)
    const sortOptions = computed(
        () =>
            viewContext.preference.value?.getTasksOptions.sort || {
                field: 'createdAt',
                order: 'desc'
            }
    )

    // @method 更新列选项
    const updateColumns = (key: string, value: boolean) => {
        if (!viewContext.preference.value) return
        const oldValue = (viewContext.preference.value.columns as Record<string, boolean>)[key]
        if (oldValue === void 0 || oldValue === value) return
        ;(viewContext.preference.value.columns as Record<string, boolean>)[key] = value
    }

    // @method 更新排序选项
    const updateSortOptions = (options: GetTasksSortOptions) => {
        if (!viewContext.preference.value) return
        viewContext.preference.value.getTasksOptions.sort = options
    }

    // @method 清除排序选项
    const clearSortOptions = () => {
        if (!viewContext.preference.value) return
        viewContext.preference.value.getTasksOptions.sort = { field: 'createdAt', order: 'desc' }
    }

    // @method 删除任务
    const deleteTask = (taskId: TaskVO['id']) => {
        if (!taskId) return
        viewContext.deleteTask(taskId)
    }

    // @method 恢复任务
    const restoreTask = (taskId: TaskVO['id']) => {
        if (!taskId) return
        viewContext.restoreTask(taskId)
    }

    // @provide 任务清单视图内容上下文
    provide<TasksProjectViewContentContext>(TASKS_PROJECT_VIEW_CONTENT_CONTEXT_KEY, {
        projectId,
        columns,
        sortOptions,
        tags: viewContext.tags,
        tasks: viewContext.tasks,
        showTaskDetails,
        deleteTask,
        restoreTask,
        updateColumns,
        updateSortOptions,
        getColumnLabel: viewContext.getColumnLabel,
        clearSortOptions,
        getProjectName: viewContext.getProjectName
    })

    // @returns
    return {
        showTaskDetails,
        updateSortOptions,
        deleteTask,
        restoreTask
    }
}
