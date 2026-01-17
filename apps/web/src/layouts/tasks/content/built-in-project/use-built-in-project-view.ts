import { computed, provide, watch } from 'vue'
import { useTasksViewStore } from '@/views/tasks'
import { useRouter } from 'vue-router'
import useBuiltInProjectLoader from '@/infrastructure/hooks/tasks-view/use-built-in-project-loader'
import useBuiltInProjectHandlers from '@/infrastructure/hooks/tasks-view/use-built-in-project-handlers'
import useTaskHandlers from '@/infrastructure/hooks/tasks-view/use-task-handlers'
import { BUILT_IN_PROJECT_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { BuiltInProjectViewProps, BuiltInProjectViewContext } from './types'
import useSubscriber from '@/infrastructure/hooks/use-subscriber'

const useBuiltInProjectView = (props: BuiltInProjectViewProps) => {
    // @stores
    const router = useRouter()
    const tasksViewStore = useTasksViewStore()

    // @hooks 清单加载器
    const builtInProjectLoader = useBuiltInProjectLoader(tasksViewStore.builtInProjectApp)

    // @hooks 清单处理函数集合
    const builtInProjectHandlers = useBuiltInProjectHandlers(tasksViewStore.builtInProjectApp)

    // @hook 待办任务列表处理函数集合
    const taskHandlers = useTaskHandlers(tasksViewStore.taskApp)

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

    // @method 初始化 - 触发获取清单详情
    const initialize = () => {
        // 1. 检查参数
        if (!props.projectId) return
        // 2. 获取清单详情
        builtInProjectLoader.load(
            tasksViewStore.userApp.states.profile?.email || 'default',
            props.projectId
        )
        if (builtInProjectLoader.states.error.message !== '') return
        // 3. 跳转至指定视图类型
        const viewType = tasksViewStore.builtInProjectApp.states.preference?.viewType || 'table'
        switchViewType(viewType)
    }

    // @watch 监听 projectId 变化
    // 当 projectId 变化时，触发获取清单详情
    watch(
        () => props.projectId,
        () => initialize(),
        { immediate: true }
    )

    // @method 获取清单名称
    const getProjectName = (projectId: string) => {
        return tasksViewStore.projectApp.getByIdFromMap(projectId)?.name || '收集箱'
    }

    // @computed 是否已经是只显示未完成任务
    const isHideCompletedAlready = computed(() => {
        if (!tasksViewStore.builtInProjectApp.states.preference) return false
        return (
            tasksViewStore.builtInProjectApp.states.preference.getTasksOptions.state ===
            'todo,in-progress'
        )
    })

    // @method 切换显示已完成
    const switchHideCompleted = () => {
        if (!tasksViewStore.builtInProjectApp.states.preference) return
        tasksViewStore.builtInProjectApp.states.preference.getTasksOptions.state =
            isHideCompletedAlready.value ? '' : 'todo,in-progress'
    }

    // @provide 提供 Project View 上下文
    provide<BuiltInProjectViewContext>(BUILT_IN_PROJECT_VIEW_CONTEXT_KEY, {
        project: computed(() => tasksViewStore.builtInProjectApp.states.builtInProject),
        preference: computed(() => tasksViewStore.builtInProjectApp.states.preference),
        tags: computed(() => tasksViewStore.tagApp.states.tags),
        tasks: computed(() => tasksViewStore.taskApp.states.tasks),
        builtInProjectHandlers,
        taskHandlers,
        subscriber,
        isHideCompletedAlready,
        getColumnLabel: tasksViewStore.getColumnLabel,
        getProjectName,
        showTaskDetails: tasksViewStore.showTaskDetails,
        switchViewTypeToTable: () => switchViewType('table'),
        switchViewTypeToKanban: () => switchViewType('kanban'),
        switchViewTypeToList: () => switchViewType('list'),
        showTaskCreator: () => tasksViewStore.dialogManager.openDialog('task-creator', {}),
        switchHideCompleted
    })

    // @returns
    return { builtInProjectLoader, initialize }
}

export default useBuiltInProjectView
