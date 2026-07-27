import { TASKS_VIEW_CONTEXT_KEY } from '@/views/index/tasks/context'
import {
    BuiltInProjectHandler,
    useBuiltInProjectsStore
} from '@nao-todo/presentation/built-in-project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { useUserStore } from '@nao-todo/presentation/user'
import { TASK_CREATOR_DIALOG_KEY, unwrapError } from '@nao-todo/shared'
import { NueMessage } from 'nue-ui'
import { storeToRefs } from 'pinia'
import { computed, inject, provide, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { BUILT_IN_PROJECT_VIEW_CONTEXT_KEY } from './context'
import type { BuiltInProjectViewProps } from './types'

const useBuiltInProjectView = (props: BuiltInProjectViewProps) => {
    // @viewStores
    const router = useRouter()

    // @viewContext TasksView context
    const {
        builtInProjectUseCase,
        appSubscriber,
        appDialogManager,
        taskUseCase,
        getColumnLabel,
        getProjectName,
        showTaskDetails
    } = inject(TASKS_VIEW_CONTEXT_KEY)!

    // @dataStores
    const userStore = useUserStore()
    const builtInProjectsStore = useBuiltInProjectsStore()
    const tagsStore = useTagsStore()

    // @presetStates
    const { builtInProjectPreference: preference } = storeToRefs(builtInProjectsStore)
    const { profile } = storeToRefs(userStore)
    const { tags } = storeToRefs(tagsStore)

    // @state 加载态
    const loading = ref(true)

    // @method 视图切换
    const switchViewType = async (viewType: string) => {
        if (!viewType) return
        if (viewType === (router.currentRoute.value.params.viewType as string)) return
        await router
            .replace({ name: 'tasks-built-in-project-main', params: { viewType } })
            .then(() => {
                preference.value!.viewType = viewType
            })
    }

    // @state 清单详情
    const builtInProject = computed(() => {
        if (!props.projectId) return void 0
        return builtInProjectsStore.getBuiltInProject(props.projectId)
    })

    // @method 初始化 - 触发获取清单详情
    const initialize = async () => {
        // 1. 检查参数
        if (!props.projectId || !profile.value) return
        loading.value = true
        // 2. 获取清单详情
        const err = builtInProjectUseCase.loadBuiltInProjectPreference(
            profile.value.email,
            props.projectId
        )
        if (err !== null) {
            NueMessage.error(unwrapError(err))
            loading.value = false
            return
        }
        // 3. 跳转至指定视图类型
        await switchViewType(preference.value?.viewType || 'table')
        loading.value = false
    }

    // @watch 监听 projectId 变化
    // 当 projectId 变化时，触发获取清单详情
    watch(
        () => props.projectId,
        () => initialize(),
        { immediate: true }
    )

    // @handler 内建清单操作器
    const builtInProjectHandlers = new BuiltInProjectHandler(
        builtInProjectUseCase,
        taskUseCase,
        builtInProjectsStore,
        appSubscriber
    )

    // @computed 是否已经是只显示未完成任务
    const isHideCompletedAlready = computed(() => {
        if (!preference.value) return false
        const state = builtInProjectsStore.getPreferenceGetTasksOption('state')
        return state == 'todo,in-progress'
    })

    // @method 打开创建任务对话框
    const showTaskCreator = () => {
        if (!builtInProject.value) return
        if (typeof builtInProject.value.createTaskOptions === 'function') {
            appDialogManager.open(
                TASK_CREATOR_DIALOG_KEY,
                builtInProject.value.createTaskOptions?.() || {}
            )
            return
        }
        appDialogManager.open(TASK_CREATOR_DIALOG_KEY, builtInProject.value.createTaskOptions)
    }

    // @provide 提供 Project View 上下文
    provide(BUILT_IN_PROJECT_VIEW_CONTEXT_KEY, {
        taskUseCase,
        builtInProject: builtInProject,
        preference,
        profile,
        tags: computed(() => [...tags.value.values()]),
        subscriber: appSubscriber,
        builtInProjectHandlers,
        isHideCompletedAlready,
        dialogManager: appDialogManager,
        getColumnLabel,
        getProjectName,
        showTaskDetails,
        switchViewTypeToTable: () => switchViewType('table'),
        switchViewTypeToKanban: () => switchViewType('kanban'),
        switchViewTypeToList: () => switchViewType('list'),
        showTaskCreator
    })

    // @returns
    return { initialize, loading }
}

export default useBuiltInProjectView