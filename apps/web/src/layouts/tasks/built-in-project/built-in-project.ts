import { computed, provide, watch } from 'vue'
import { useTasksViewStore } from '@/views/index/tasks'
import { useRouter } from 'vue-router'
import { BUILT_IN_PROJECT_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { BuiltInProjectViewProps, BuiltInProjectViewContext } from './types'
// import useAppStore from '@/views/app-store'
import useSubscriber from '@/infrastructure/hooks/use-subscriber'
import useUserStore from '@nao-todo/application/web/stores/user-store'
import { storeToRefs } from 'pinia'
import { BuiltInProjectLayoutHandlers } from '@nao-todo/application/web/handlers/built-in-project-layout'
import { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import { TaskDomain } from '@nao-todo/domain/task'
import { useTaskRepository } from '@nao-todo/infrastructure/backend/task/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { useBuiltInProjectsStore, useTagsStore, useTasksStore } from '@/stores/tasks'

const useBuiltInProjectView = (props: BuiltInProjectViewProps) => {
    // @viewStores
    const router = useRouter()
    // const appStore = useAppStore()
    const tasksViewStore = useTasksViewStore()

    // @dataStores
    const userStore = useUserStore()
    const builtInProjectsStore = useBuiltInProjectsStore()
    const tagsStore = useTagsStore()
    const tasksStore = useTasksStore()

    // @presetStates
    const { builtInProjectPreference: preference } = storeToRefs(builtInProjectsStore)
    const { profile } = storeToRefs(userStore)
    const { tags } = storeToRefs(tagsStore)

    // @hooks 事件监听
    const subscriber = useSubscriber()

    // @method 视图切换
    const switchViewType = async (viewType: string) => {
        if (!viewType) return
        if (viewType === (router.currentRoute.value.params.viewType as string)) return
        const err = await router.replace({
            name: 'tasks-built-in-project-main',
            params: { viewType }
        })
        if (err) {
            console.error(err)
        }
    }

    // @state 清单详情
    const builtInProject = computed(() => {
        if (!props.projectId) return void 0
        return builtInProjectsStore.getBuiltInProject(props.projectId)
    })

    // @method 初始化 - 触发获取清单详情
    const initialize = () => {
        // 1. 检查参数
        if (!props.projectId || !profile.value) return
        // 2. 获取清单详情
        tasksViewStore.builtInProjectUseCase.loadBuiltInProjectPreference(
            profile.value.email,
            props.projectId
        )
        // 3. 跳转至指定视图类型
        switchViewType(preference.value?.viewType || 'table')
    }

    // @watch 监听 projectId 变化
    // 当 projectId 变化时，触发获取清单详情
    watch(
        () => props.projectId,
        () => initialize(),
        { immediate: true }
    )

    // @usecase 任务用例
    const taskUseCase = new TaskUseCase(
        new TaskDomain(useTaskRepository(getRequesterImpl())),
        tasksStore
    )

    // @handler 内建清单操作器
    const builtInProjectHandlers = new BuiltInProjectLayoutHandlers(
        taskUseCase,
        builtInProjectsStore
    )

    // @computed 是否已经是只显示未完成任务
    const isHideCompletedAlready = computed(() => {
        if (!preference.value) return false
        const state = builtInProjectsStore.getPreferenceGetTasksOption('state')
        return state === 'todo,in-progress'
    })

    // @provide 提供 Project View 上下文
    provide<BuiltInProjectViewContext>(BUILT_IN_PROJECT_VIEW_CONTEXT_KEY, {
        taskUseCase,
        builtInProject: builtInProject,
        preference,
        tags: computed(() => [...tags.value.values()]),
        // builtInProjectHandlers,
        // taskHandlers,
        subscriber,
        builtInProjectHandlers,
        isHideCompletedAlready,
        getColumnLabel: tasksViewStore.getColumnLabel,
        getProjectName: tasksViewStore.getProjectName,
        showTaskDetails: tasksViewStore.showTaskDetails,
        switchViewTypeToTable: () => switchViewType('table'),
        switchViewTypeToKanban: () => switchViewType('kanban'),
        switchViewTypeToList: () => switchViewType('list'),
        showTaskCreator: () => tasksViewStore.dialogManager.openDialog('task-creator', {})
    })

    // @returns
    return { initialize }
}

export default useBuiltInProjectView
