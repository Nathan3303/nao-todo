import { useTagUseCase, useTaskUseCase } from '@/hooks'
import { useTasksStore } from '@nao-todo/presentation/task'
import { TASKS_VIEW_CONTEXT_KEY } from '@/views/index/tasks/context'
import { TagHandler, useTagsStore } from '@nao-todo/presentation/tag'
import { useUserStore } from '@nao-todo/presentation-identity'
import { TASK_CREATOR_DIALOG_KEY } from '@nao-todo/shared/constants'
import { unwrapError } from '@nao-todo/shared/utils/user-facing-go-error'
import { NueMessage } from 'nue-ui'
import { storeToRefs } from 'pinia'
import { computed, inject, provide, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { recordShellError } from '@/error-observability'
import { resolveTasksViewType, runBoundedTasksInitialize } from '@/components/tasks/view-type'
import { TAG_VIEW_CONTEXT_KEY } from './context'
import type { TagViewProps } from './types'

const useTagView = (props: TagViewProps) => {
    // @viewStores
    const router = useRouter()

    // @viewContext TasksView context
    const { appSubscriber, appDialogManager, getColumnLabel, getProjectName, showTaskDetails } =
        inject(TASKS_VIEW_CONTEXT_KEY)!

    // @dataStores
    const userStore = useUserStore()
    const tagsStore = useTagsStore()

    // @usecase 业务依赖本地组装（DI 入口；不来自父视图上下文）
    const tagUseCase = useTagUseCase(tagsStore)
    const taskUseCase = useTaskUseCase(useTasksStore())

    // @presetStates
    const { profile } = storeToRefs(userStore)
    const { tags, tagPreference: preference } = storeToRefs(tagsStore)

    // @state 加载态
    const loading = ref(true)

    // @method 视图切换
    const switchViewType = async (viewType: string) => {
        if (!viewType) return
        if (viewType === (router.currentRoute.value.params.viewType as string)) return
        await router.replace({ name: 'tasks-tag-main', params: { viewType } }).then(() => {
            preference.value!.viewType = viewType
        })
    }

    // @state 标签详情
    const tag = computed(() => {
        if (!props.tagId) return void 0
        return tagsStore.getTag(props.tagId)
    })

    // @method 初始化 - 触发获取标签详情（C-31：不得以 profile 为前置；loading 有界）
    const initialize = async () => {
        await runBoundedTasksInitialize(
            async () => {
                // 1. 检查参数
                if (!props.tagId) return
                // 2. 获取标签详情（离线失败/抛错均落终态，不永加载）
                const err = await tagUseCase.loadTagPreference(props.tagId)
                if (err !== null) {
                    NueMessage.error(unwrapError(err))
                    return
                }
                // 3. 跳转至指定视图类型（C-32：本地 preference 优先，缺省硬默认 table）
                await switchViewType(resolveTasksViewType(preference.value))
            },
            (value) => (loading.value = value),
            (error) => recordShellError('tasks:tag:initialize', error)
        )
    }

    // @watch 监听 tagId 变化
    // 当 tagId 变化时，触发获取标签详情
    watch(
        () => props.tagId,
        () => initialize(),
        { immediate: true }
    )

    // @handler 标签操作器
    const tagHandler = new TagHandler(tagUseCase, tagsStore, appSubscriber)

    // @computed 是否已经是只显示未完成任务
    const isHideCompletedAlready = computed(() => {
        if (!preference.value) return false
        const state = tagsStore.getPreferenceGetTasksOption('state')
        // console.log(state)
        return state == 'todo,in-progress'
    })

    // @method 显示任务创建器
    const showTaskCreator = () => {
        appDialogManager.open(TASK_CREATOR_DIALOG_KEY, { tags: [props.tagId] })
    }

    // @provide 提供 Tag View 上下文
    provide(TAG_VIEW_CONTEXT_KEY, {
        taskUseCase,
        tagUseCase,
        tag,
        preference,
        dialogManager: appDialogManager,
        subscriber: appSubscriber,
        profile,
        tags: computed(() => [...tags.value.values()]),
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