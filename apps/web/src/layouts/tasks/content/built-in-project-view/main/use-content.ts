import type {
    GetTasksSortOptions,
    ProjectVO,
    TagVO,
    TaskColumnOptions,
    TaskVO,
    WithNull
} from '@nao-todo/types'
import { type TasksProjectViewContext } from '../use-project-view'
import {
    TASKS_PROJECT_VIEW_CONTEXT_KEY,
    TASKS_PROJECT_VIEW_CONTENT_CONTEXT_KEY
} from '../constants'
import { computed, inject, provide, type ComputedRef, type Ref } from 'vue'
import type { TaskApp } from '@nao-todo/application/task'

export type TasksProjectViewContentProps = {
    projectId?: string
    viewType?: string
    todoId?: string
}

export type TasksProjectViewContentContext = {
    projectId: ComputedRef<WithNull<ProjectVO['id']>>
    columns: ComputedRef<WithNull<TaskColumnOptions>>
    sortOptions: ComputedRef<WithNull<GetTasksSortOptions>>
    tags: Ref<TagVO[]>
    tasks: ComputedRef<TaskVO[]>
    showTaskDetails: (taskId: TaskVO['id']) => void
    deleteTask: (taskId: TaskVO['id']) => void
    restoreTask: (taskId: TaskVO['id']) => void
    updateColumns: (key: string, value: boolean) => void
    updateSortOptions: (options: GetTasksSortOptions) => void
    getColumnLabel: (key: string) => string
    clearSortOptions: () => void
    getProjectName: (projectId: string) => string
    taskLister: TaskApp['list']
}

export default () => {
    // @context 任务清单视图上下文
    const {
        showTaskDetails,
        project,
        preference,
        tasks,
        tags,
        getColumnLabel,
        getProjectName,
        restoreTask,
        deleteTask,
        taskLister
    } = inject<TasksProjectViewContext>(TASKS_PROJECT_VIEW_CONTEXT_KEY)!

    // @proxy
    const projectId = computed(() => project.value?.id || null)
    const columns = computed(() => preference.value?.columns || null)
    const sortOptions = computed(
        () =>
            preference.value?.getTasksOptions.sort || {
                field: 'createdAt',
                order: 'desc'
            }
    )

    // @method 更新列选项
    const updateColumns = (key: string, value: boolean) => {
        if (!preference.value) return
        const oldValue = (preference.value.columns as Record<string, boolean>)[key]
        if (oldValue === void 0 || oldValue === value) return
        ;(preference.value.columns as Record<string, boolean>)[key] = value
    }

    // @method 更新排序选项
    const updateSortOptions = (options: GetTasksSortOptions) => {
        if (!preference.value) return
        preference.value.getTasksOptions.sort = options
    }

    // @method 清除排序选项
    const clearSortOptions = () => {
        if (!preference.value) return
        preference.value.getTasksOptions.sort = { field: 'createdAt', order: 'desc' }
    }

    // @provide 任务清单视图内容上下文
    provide<TasksProjectViewContentContext>(TASKS_PROJECT_VIEW_CONTENT_CONTEXT_KEY, {
        projectId,
        columns,
        sortOptions,
        tags,
        tasks: computed(() => tasks.value),
        showTaskDetails,
        deleteTask,
        restoreTask,
        updateColumns,
        updateSortOptions,
        getColumnLabel,
        clearSortOptions,
        getProjectName,
        taskLister
    })

    // @returns
    return {
        showTaskDetails,
        updateSortOptions,
        deleteTask,
        restoreTask
    }
}
