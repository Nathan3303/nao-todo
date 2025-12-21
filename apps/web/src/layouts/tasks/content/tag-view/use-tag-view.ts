import { useTasksViewStore } from '@/views/tasks'
import type { TagPreferenceVO, TagVO, WithNull } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/utils'
import { computed, provide, reactive, ref, watch, type ComputedRef } from 'vue'

export type TasksTagViewProps = {
    tagId?: string
    taskId?: string
}

export type TasksTagViewContext = {
    tag: ComputedRef<TagVO | null>
    preference: ComputedRef<TagPreferenceVO | null>
}

export const TASKS_TAG_VIEW_CONTEXT_KEY = Symbol('TASKS_TAG_VIEW_CONTEXT_KEY')

export default (props: TasksTagViewProps) => {
    const tasksViewStore = useTasksViewStore()

    const loading = ref(true)
    const error = reactive({ message: '', errorImage: '/images/error.png' })

    // @state 标签详情
    const tag = ref<WithNull<TagVO>>(null)
    const preference = ref<WithNull<TagPreferenceVO>>(null)

    // @method 根据 ID 获取标签详情
    const fetchTagById = async () => {
        // 1. 校验参数
        if (!props.tagId) {
            error.message = '参数错误'
            return
        }
        // 2. 获取标签详情
        const t = tasksViewStore.tagApp.getByIdFromMap(props.tagId)
        if (!t) {
            error.message = '标签数据获取失败'
            return
        }
        // 3. 获取标签偏好
        const [pp, err] = await tasksViewStore.tagApp.getPreference(props.tagId)
        if (err !== null) {
            error.message = unwrapError(err)
            return
        }
        // 4. 更新状态
        tag.value = t
        preference.value = pp
        console.log(tag.value, preference.value)
    }

    // @watch 监听 tagId 变化
    // 当 tagId 变化时，触发获取标签详情
    watch(
        () => props.tagId,
        () => {
            loading.value = true
            fetchTagById().finally(() => {
                loading.value = false
            })
        },
        { immediate: true }
    )

    // @provide 提供 Tag View 上下文
    provide<TasksTagViewContext>(TASKS_TAG_VIEW_CONTEXT_KEY, {
        tag: computed(() => tag.value),
        preference: computed(() => preference.value)
    })

    return {
        loading,
        error,
        tag: computed(() => tag.value),
        preference: computed(() => preference.value)
    }
}
