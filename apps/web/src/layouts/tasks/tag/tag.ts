import { computed, inject, provide, watch } from 'vue'
import { useRouter } from 'vue-router'
import { TAG_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { TagViewContext, TagViewProps } from './types'
import useSubscriber from '@/infrastructure/hooks/use-subscriber'
import useUserStore from '@nao-todo/application/web/stores/user-store'
import { storeToRefs } from 'pinia'
import { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import { TaskDomain } from '@nao-todo/domain/task'
import { useTaskRepository } from '@nao-todo/infrastructure/backend/task/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { useTagsStore, useTasksStore } from '@/stores/tasks'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'
import { TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { TagHandler } from '@/handlers/tasks/tag-handler'

const useTagView = (props: TagViewProps) => {
    // @viewStores
    const router = useRouter()

    // @viewContext TasksView context
    const tasksViewContext = inject<TasksViewContext>(TASKS_VIEW_CONTEXT_KEY)!

    // @dataStores
    const userStore = useUserStore()
    const tagsStore = useTagsStore()
    const tasksStore = useTasksStore()

    // @presetStates
    const { profile } = storeToRefs(userStore)
    const { tags, tagPreference: preference } = storeToRefs(tagsStore)

    // @hooks 事件监听
    const subscriber = useSubscriber()

    // @method 视图切换
    const switchViewType = (viewType: string) => {
        if (!viewType) return
        if (viewType === (router.currentRoute.value.params.viewType as string)) return
        router.replace({ name: 'tasks-tag-main', params: { viewType } })
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
        // 2. 获取标签详情
        const err = await tasksViewContext.tagUseCase.loadTagPreference(props.tagId)
        if (err !== null) {
            NueMessage.error(unwrapError(err))
            return
        }
        // 3. 跳转至指定视图类型
        switchViewType(preference.value?.viewType || 'table')
    }

    // @watch 监听 tagId 变化
    // 当 tagId 变化时，触发获取标签详情
    watch(
        () => props.tagId,
        () => initialize(),
        { immediate: true }
    )

    // @usecase 任务用例
    const taskUseCase = new TaskUseCase(
        new TaskDomain(useTaskRepository(getRequesterImpl())),
        tasksStore
    )

    // @handler 标签操作器
    const tagHandler = new TagHandler(
        taskUseCase,
        tasksViewContext.tagUseCase,
        tagsStore,
        subscriber
    )

    // @computed 是否已经是只显示未完成任务
    const isHideCompletedAlready = computed(() => {
        if (!preference.value) return false
        const state = tagsStore.getPreferenceGetTasksOption('state')
        // console.log(state)
        return state == 'todo,in-progress'
    })

    // @provide 提供 Tag View 上下文
    provide<TagViewContext>(TAG_VIEW_CONTEXT_KEY, {
        tasksViewContext,
        taskUseCase,
        tag,
        preference,
        profile,
        tags: computed(() => [...tags.value.values()]),
        subscriber,
        tagHandler,
        isHideCompletedAlready,
        getColumnLabel: tasksViewContext.getColumnLabel,
        getProjectName: tasksViewContext.getProjectName,
        showTaskDetails: tasksViewContext.showTaskDetails,
        switchViewTypeToTable: () => switchViewType('table'),
        switchViewTypeToKanban: () => switchViewType('kanban'),
        switchViewTypeToList: () => switchViewType('list'),
        showTaskCreator: () =>
            tasksViewContext.dialogManager.openDialog('task-creator', { tags: [props.tagId] })
    })

    // @returns
    return { initialize }
}

export default useTagView
