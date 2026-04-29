import { computed, inject, provide, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { BUILT_IN_PROJECT_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { BuiltInProjectViewProps, BuiltInProjectViewContext } from './types'
import useUserStore from '@/stores/user-store'
import { storeToRefs } from 'pinia'
import { BuiltInProjectLayoutHandlers } from '@/infrastructure/handlers/tasks/built-in-project-handler'
import { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import { useBuiltInProjectsStore, useTagsStore, useTasksStore } from '@/stores/tasks'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'
import { TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'

const useBuiltInProjectView = (props: BuiltInProjectViewProps) => {
    // @viewStores
    const router = useRouter()

    // @viewContext TasksView context
    const tasksViewContext = inject<TasksViewContext>(TASKS_VIEW_CONTEXT_KEY)!

    // @dataStores
    const userStore = useUserStore()
    const builtInProjectsStore = useBuiltInProjectsStore()
    const tagsStore = useTagsStore()
    const tasksStore = useTasksStore()

    // @presetStates
    const { builtInProjectPreference: preference } = storeToRefs(builtInProjectsStore)
    const { profile } = storeToRefs(userStore)
    const { tags } = storeToRefs(tagsStore)

    // @state 加载态
    const loading = ref(true)

    // @method 视图切换
    const switchViewType = (viewType: string) => {
        if (!viewType) return
        if (viewType === (router.currentRoute.value.params.viewType as string)) return
        router.replace({ name: 'tasks-built-in-project-main', params: { viewType } }).then(() => {
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
        const err = tasksViewContext.builtInProjectUseCase.loadBuiltInProjectPreference(
            profile.value.email,
            props.projectId
        )
        if (err !== null) {
            NueMessage.error(unwrapError(err))
            loading.value = false
            return
        }
        // 3. 跳转至指定视图类型
        switchViewType(preference.value?.viewType || 'table')
        loading.value = false
    }

    // @watch 监听 projectId 变化
    // 当 projectId 变化时，触发获取清单详情
    watch(
        () => props.projectId,
        () => initialize(),
        { immediate: true }
    )

    // @usecase 任务用例
    const taskUseCase = TaskUseCase.create(tasksStore)

    // @handler 内建清单操作器
    const builtInProjectHandlers = new BuiltInProjectLayoutHandlers(
        tasksViewContext.builtInProjectUseCase,
        taskUseCase,
        builtInProjectsStore
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
            tasksViewContext.dialogManager.openDialog(
                'task-creator',
                builtInProject.value.createTaskOptions?.() || {}
            )
            return
        }
        tasksViewContext.dialogManager.openDialog(
            'task-creator',
            builtInProject.value.createTaskOptions
        )
    }

    // @provide 提供 Project View 上下文
    provide<BuiltInProjectViewContext>(BUILT_IN_PROJECT_VIEW_CONTEXT_KEY, {
        tasksViewContext,
        taskUseCase,
        builtInProject: builtInProject,
        preference,
        profile,
        tags: computed(() => [...tags.value.values()]),
        subscriber: tasksViewContext.subscriber,
        builtInProjectHandlers,
        isHideCompletedAlready,
        getColumnLabel: tasksViewContext.getColumnLabel,
        getProjectName: tasksViewContext.getProjectName,
        showTaskDetails: tasksViewContext.showTaskDetails,
        switchViewTypeToTable: () => switchViewType('table'),
        switchViewTypeToKanban: () => switchViewType('kanban'),
        switchViewTypeToList: () => switchViewType('list'),
        showTaskCreator
    })

    // @returns
    return { initialize, loading }
}

export default useBuiltInProjectView

