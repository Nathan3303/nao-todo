import { computed, provide, reactive, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useTasksViewStore } from '@/views/tasks'
import type { ProjectPreferenceVO, ProjectVO, TagVO, TaskVO, WithNull } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/utils'
import { useRouter } from 'vue-router'
import { NueMessage } from 'nue-ui'
import { TASKS_PROJECT_VIEW_CONTEXT_KEY } from './constants'
import type { TaskApp } from '@nao-todo/application/task'

export type TasksProjectViewProps = {
    projectId?: string
    taskId?: string
}

export type TasksProjectViewContext = {
    project: ComputedRef<ProjectVO | null>
    preference: ComputedRef<ProjectPreferenceVO | null>
    tags: ComputedRef<TagVO[]>
    tasks: Ref<TaskVO[]>
    getColumnLabel: (key: string) => string
    savePreference: () => void
    showTaskDetails: (taskId: TaskVO['id']) => void
    deleteTask: (taskId: TaskVO['id']) => void
    restoreTask: (taskId: TaskVO['id']) => void
    getProjectName: (projectId: string) => string
    taskLister: TaskApp['list']
}

export default (props: TasksProjectViewProps) => {
    const router = useRouter()
    const tasksViewStore = useTasksViewStore()

    const project = ref<WithNull<ProjectVO>>(null)
    const preference = ref<WithNull<ProjectPreferenceVO>>(null)
    const loading = ref(true)
    const error = reactive({ message: '', errorImage: '/images/error.png' })

    // @method 根据 ID 获取清单详情
    const fetchProjectById = async () => {
        // 1. 校验参数
        if (!props.projectId) {
            error.message = '参数错误'
            return
        }
        // 2. 获取清单详情
        error.message = ''
        const p = tasksViewStore.builtInProjectApp.getByIdFromMap(props.projectId)
        if (!p) {
            error.message = '清单数据获取失败'
            return
        }
        // 3. 获取清单偏好
        const [pp, err] = tasksViewStore.builtInProjectApp.getPreference(
            tasksViewStore.userApp.states.profile?.email || 'default',
            props.projectId
        )
        if (err !== null) {
            error.message = unwrapError(err)
            return
        }
        // 4. 更新状态
        project.value = p
        preference.value = pp
    }

    // @method 根据清单偏好获取任务列表
    const fetchTasks = async () => {
        // 1. 校验参数
        if (!project.value || !preference.value) {
            error.message = '参数错误'
            return
        }
        // 2. 获取任务列表
        // const getTasksOptions = preference.value.getTasksOptions
        const [, err] = await tasksViewStore.taskApp.list({
            ...preference.value.getTasksOptions
        })
        if (err !== null) {
            error.message = unwrapError(err)
            return
        }
        error.message = ''
    }

    // @method 初始化 - 触发获取清单详情
    const initialize = () => {
        loading.value = true
        fetchProjectById()
            .then(fetchTasks)
            .then(() => {
                router.replace({
                    name: 'tasks-built-in-project-main',
                    params: { viewType: preference.value?.viewType || 'table' }
                })
            })
            .finally(() => {
                loading.value = false
            })
    }

    // @watch 监听 projectId 变化
    // 当 projectId 变化时，触发获取清单详情
    watch(
        () => props.projectId,
        () => initialize(),
        { immediate: true }
    )

    // @method 更新清单偏好设置
    const savePreference = () => {
        // 1. 校验参数
        if (!project.value || !preference.value) {
            error.message = '参数错误'
            return
        }
        // 2. 更新清单偏好
        const err = tasksViewStore.builtInProjectApp.updatePreference(
            tasksViewStore.userApp.states.profile?.email || 'default',
            project.value.id,
            preference.value
        )
        if (err !== null) {
            NueMessage.error('清单偏好更新失败' + unwrapError(err))
            return
        }
        // 3. 更新成功
        NueMessage.success('清单偏好更新成功')
    }

    // @method 删除任务
    const deleteTask = async (taskId: TaskVO['id']) => {
        // 1. 校验参数
        if (!taskId) {
            NueMessage.error('任务删除失败：参数错误')
            return
        }
        // 2. 删除任务
        const err = await tasksViewStore.taskApp.remove(taskId)
        if (err !== null) {
            NueMessage.error('任务删除失败：' + unwrapError(err))
            return
        }
        // 3. 删除成功
        NueMessage.success('任务删除成功')
    }

    // @method 恢复任务
    const restoreTask = async (taskId: TaskVO['id']) => {
        // 1. 校验参数
        if (!taskId) {
            NueMessage.error('任务恢复失败：参数错误')
            return
        }
        // 2. 恢复任务
        const err = await tasksViewStore.taskApp.restore(taskId)
        if (err !== null) {
            NueMessage.error('任务恢复失败：' + unwrapError(err))
            return
        }
        // 3. 恢复成功
        NueMessage.success('任务恢复成功')
    }

    // @method 获取清单名称
    const getProjectName = (projectId: string) => {
        return tasksViewStore.builtInProjectApp.getByIdFromMap(projectId)?.name || '收集箱'
    }

    // @provide 提供 Project View 上下文
    provide<TasksProjectViewContext>(TASKS_PROJECT_VIEW_CONTEXT_KEY, {
        project: computed(() => project.value),
        preference: computed(() => preference.value),
        tags: computed(() => tasksViewStore.tagApp.tags),
        tasks: computed(() => tasksViewStore.taskApp.states.tasks),
        getColumnLabel: tasksViewStore.getColumnLabel,
        savePreference,
        showTaskDetails: tasksViewStore.showTaskDetails,
        deleteTask,
        restoreTask,
        getProjectName,
        taskLister: tasksViewStore.taskApp.list
    })

    // @returns
    return {
        loading,
        error,
        project,
        preference,
        initialize
    }
}
