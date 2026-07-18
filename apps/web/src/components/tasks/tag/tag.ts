import { computed, inject, provide, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { TagViewProps } from './types'
import useUserStore from '@/stores/user-store'
import { storeToRefs } from 'pinia'
import { useTagsStore } from '@/stores'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { TASK_CREATOR_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'
import { TASKS_VIEW_CONTEXT_KEY } from '@/views/index/tasks/context'
import { TagHandler } from '@/infrastructure/handlers/tag'
import { TAG_VIEW_CONTEXT_KEY } from './context'

const useTagView = (props: TagViewProps) => {
    // @viewStores
    const router = useRouter()

    // @viewContext TasksView context
    const {
        taskUseCase,
        tagUseCase,
        subscriber,
        getColumnLabel,
        getProjectName,
        showTaskDetails,
        dialogManager
    } = inject(TASKS_VIEW_CONTEXT_KEY)!

    // @dataStores
    const userStore = useUserStore()
    const tagsStore = useTagsStore()

    // @presetStates
    const { profile } = storeToRefs(userStore)
    const { tags, tagPreference: preference } = storeToRefs(tagsStore)

    // @state 加载态
    const loading = ref(true)

    // @method 视图切换
    const switchViewType = (viewType: string) => {
        if (!viewType) return
        if (viewType === (router.currentRoute.value.params.viewType as string)) return
        router.replace({ name: 'tasks-tag-main', params: { viewType } }).then(() => {
            preference.value!.viewType = viewType
        })
    }

    // @state 标签详情
    const tag = computed(() => {
        if (!props.tagId) return void 0
        return tagsStore.getTag(props.tagId)
    })

    // @method 初始化 - 触发获取标签详情
    const initialize = async () => {
        // 1. 检查参数
        if (!props.tagId || !profile.value) return
        loading.value = true
        // 2. 获取标签详情
        const err = await tagUseCase.loadTagPreference(props.tagId)
        if (err !== null) {
            NueMessage.error(unwrapError(err))
            loading.value = false
            return
        }
        // 3. 跳转至指定视图类型
        switchViewType(preference.value?.viewType || 'table')
        loading.value = false
    }

    // @watch 监听 tagId 变化
    // 当 tagId 变化时，触发获取标签详情
    watch(
        () => props.tagId,
        () => initialize(),
        { immediate: true }
    )

    // @handler 标签操作器
    const tagHandler = new TagHandler(tagUseCase, tagsStore, subscriber)

    // @computed 是否已经是只显示未完成任务
    const isHideCompletedAlready = computed(() => {
        if (!preference.value) return false
        const state = tagsStore.getPreferenceGetTasksOption('state')
        // console.log(state)
        return state == 'todo,in-progress'
    })

    // @method 显示任务创建器
    const showTaskCreator = () => {
        dialogManager.open(TASK_CREATOR_DIALOG_KEY, { tags: [props.tagId] })
    }

    // @provide 提供 Tag View 上下文
    provide(TAG_VIEW_CONTEXT_KEY, {
        taskUseCase,
        tagUseCase,
        tag,
        preference,
        dialogManager,
        profile,
        tags: computed(() => [...tags.value.values()]),
        subscriber,
        tagHandler,
        isHideCompletedAlready,
        getColumnLabel,
        getProjectName,
        showTaskDetails,
        showTaskCreator,
        switchViewTypeToTable: () => switchViewType('table'),
        switchViewTypeToKanban: () => switchViewType('kanban'),
        switchViewTypeToList: () => switchViewType('list')
    })

    // @returns
    return { initialize, loading }
}

export default useTagView

