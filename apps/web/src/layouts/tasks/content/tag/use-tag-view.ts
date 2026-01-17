import { computed, provide, watch } from 'vue'
import { useTasksViewStore } from '@/views/tasks'
import { useRouter } from 'vue-router'
import useTagLoader from '@/infrastructure/hooks/tasks-view/use-tag-loader'
import useTagHandlers from '@/infrastructure/hooks/tasks-view/use-tag-handlers'
import useTaskHandlers from '@/infrastructure/hooks/tasks-view/use-task-handlers'
import { TAG_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { TagViewProps, TagViewContext } from './types'
import useSubscriber from '@/infrastructure/hooks/use-subscriber'

const useTagView = (props: TagViewProps) => {
    // @stores
    const router = useRouter()
    const tasksViewStore = useTasksViewStore()

    // @hooks 标签加载器
    const tagLoader = useTagLoader(tasksViewStore.tagApp)

    // @hooks 标签处理函数集合
    const tagHandlers = useTagHandlers(tasksViewStore.tagApp)

    // @hook 待办任务列表处理函数集合
    const taskHandlers = useTaskHandlers(tasksViewStore.taskApp)

    // @hooks 事件监听
    const subscriber = useSubscriber()

    // @method 视图切换
    const switchViewType = async (viewType: string) => {
        if (!viewType) return
        if (viewType === (router.currentRoute.value.params.viewType as string)) return
        const err = await router.replace({
            name: 'tasks-tag-main',
            params: { viewType }
        })
        if (err) {
            console.error(err)
        }
    }

    // @method 初始化 - 触发获取标签详情
    const initialize = async () => {
        // 1. 检查参数
        if (!props.tagId) return
        // 2. 获取标签详情
        await tagLoader.load(props.tagId)
        if (tagLoader.states.error.message !== '') return
        // 3. 跳转至指定视图类型
        const viewType = tasksViewStore.tagApp.states.preference?.viewType || 'table'
        switchViewType(viewType)
    }

    // @watch 监听 tagId 变化
    // 当 tagId 变化时，触发获取标签详情
    watch(
        () => props.tagId,
        async () => await initialize(),
        { immediate: true }
    )

    // @method 获取清单名称
    const getProjectName = (projectId: string) => {
        return tasksViewStore.projectApp.getByIdFromMap(projectId)?.name || '收集箱'
    }

    // @computed 是否已经是只显示未完成任务
    const isHideCompletedAlready = computed(() => {
        if (!tasksViewStore.tagApp.states.preference) return false
        return tasksViewStore.tagApp.states.preference.getTasksOptions.state === 'todo,in-progress'
    })

    // @method 切换显示已完成
    const switchHideCompleted = () => {
        if (!tasksViewStore.tagApp.states.preference) return
        tasksViewStore.tagApp.states.preference.getTasksOptions.state = isHideCompletedAlready.value
            ? ''
            : 'todo,in-progress'
    }

    // @provide 提供 Tag View 上下文
    provide<TagViewContext>(TAG_VIEW_CONTEXT_KEY, {
        tag: computed(() => tasksViewStore.tagApp.states.tag),
        preference: computed(() => tasksViewStore.tagApp.states.preference),
        tags: computed(() => tasksViewStore.tagApp.states.tags),
        tasks: computed(() => tasksViewStore.taskApp.states.tasks),
        tagHandlers,
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
    return { tagLoader, initialize }
}

export default useTagView
