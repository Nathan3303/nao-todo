import { computed, provide, reactive, ref, watch, type ComputedRef } from 'vue'
import { useTasksViewStore } from '@/views/tasks'
import type { ProjectPreferenceVO, ProjectVO, WithNull } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/utils'

export type TasksProjectViewProps = {
    projectId?: string
    taskId?: string
}

export type TasksProjectViewContext = {
    project: ComputedRef<ProjectVO | null>
    preference: ComputedRef<ProjectPreferenceVO | null>
}

export const TASKS_PROJECT_VIEW_CONTEXT_KEY = Symbol('TASKS_PROJECT_VIEW_CONTEXT_KEY')

export default (props: TasksProjectViewProps) => {
    const tasksViewStore = useTasksViewStore()

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
        loading.value = true
        error.message = ''
        const p = tasksViewStore.projectApp.getByIdFromMap(props.projectId)
        if (!p) {
            error.message = '清单数据获取失败'
            return
        }
        // 3. 获取清单偏好
        const [pp, err] = await tasksViewStore.projectApp.getPreference(props.projectId)
        if (err !== null) {
            error.message = unwrapError(err)
            return
        }
        // 4. 更新状态
        project.value = p
        preference.value = pp
        console.log(project.value, preference.value)
    }

    // @watch 监听 projectId 变化
    // 当 projectId 变化时，触发获取清单详情
    watch(
        () => props.projectId,
        () => {
            loading.value = true
            fetchProjectById().finally(() => {
                loading.value = false
            })
        },
        { immediate: true }
    )

    // @provide 提供 Project View 上下文
    provide<TasksProjectViewContext>(TASKS_PROJECT_VIEW_CONTEXT_KEY, {
        project: computed(() => project.value),
        preference: computed(() => preference.value)
    })

    return {
        loading,
        error,
        project,
        preference
    }
}
