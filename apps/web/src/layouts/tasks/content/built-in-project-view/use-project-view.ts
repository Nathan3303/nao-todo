import { computed, provide, reactive, ref, watch, type ComputedRef } from 'vue'
import { useTasksViewStore } from '@/views/tasks'
import type { ProjectPreferenceVO, ProjectVO, WithNull } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/utils'
import { useRouter } from 'vue-router'
import { NueMessage } from 'nue-ui'

export type TasksProjectViewProps = {
    projectId?: string
    taskId?: string
}

export type TasksProjectViewContext = {
    project: ComputedRef<ProjectVO | null>
    preference: ComputedRef<ProjectPreferenceVO | null>
    getColumnLabel: (key: string) => string
    savePreference: () => void
}

export const TASKS_PROJECT_VIEW_CONTEXT_KEY = Symbol('TASKS_PROJECT_VIEW_CONTEXT_KEY')

export default (props: TasksProjectViewProps) => {
    const tasksViewStore = useTasksViewStore()
    const router = useRouter()

    const loading = ref(true)
    const error = reactive({ message: '', errorImage: '/images/error.png' })

    // @state 清单详情
    const project = ref<WithNull<ProjectVO>>(null)
    const preference = ref<WithNull<ProjectPreferenceVO>>(null)

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
            tasksViewStore.userProfile?.email || 'default',
            props.projectId
        )
        if (err !== null) {
            error.message = unwrapError(err)
            return
        }
        // 4. 更新状态
        project.value = p
        preference.value = pp
        console.log(project.value, preference.value)
    }

    // @method 初始化 - 触发获取清单详情
    const initialize = () => {
        loading.value = true
        fetchProjectById().finally(() => {
            router.replace({
                name: 'tasks-built-in-project-main',
                params: { viewType: preference.value?.viewType || 'table' }
            })
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
            tasksViewStore.userProfile?.email || 'default',
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

    // @provide 提供 Project View 上下文
    provide<TasksProjectViewContext>(TASKS_PROJECT_VIEW_CONTEXT_KEY, {
        project: computed(() => project.value),
        preference: computed(() => preference.value),
        getColumnLabel: tasksViewStore.getColumnLabel,
        savePreference
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
