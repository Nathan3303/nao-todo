import { BUILT_IN_PROJECT_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { BuiltInProjectViewContext } from '../../types'
import { computed, inject, watch } from 'vue'
import useTasksLoader from '@/infrastructure/hooks/tasks-view/use-task-loader'
// import { useTasksViewStore } from '@/views/tasks'
import { useTasksStore } from '@/stores/tasks'

const useTable = () => {
    // @viewStore
    // const tasksViewStore = useTasksViewStore()

    // @dataStore
    const tasksStore = useTasksStore()

    // @viewContext
    const viewContext = inject<BuiltInProjectViewContext>(BUILT_IN_PROJECT_VIEW_CONTEXT_KEY)!

    // @hook 待办任务加载器
    const taskLoader = useTasksLoader(viewContext.taskUseCase, {
        ...viewContext.preference.value?.getTasksOptions
    })

    // @state 任务数据
    const tasks = computed(() => {
        return taskLoader.states.taskIds
            .map((taskId) => tasksStore.getTask(taskId)!)
            .filter(Boolean)
    })

    // @method 初始化表格
    const initTable = () => {
        taskLoader.loadFirstPage(true)
    }

    // @method 更新页码
    const handleUpdatePage = (page: number) => {
        taskLoader.states.pagination.page = page
        taskLoader.loadAndReplace()
    }

    // @method 更新每页显示数量
    const handleUpdatePerPage = (limit: number) => {
        taskLoader.states.pagination.limit = limit
        handleUpdatePage(1)
    }

    // @watch 监听获取选项变化
    watch(
        () => viewContext.preference.value?.getTasksOptions,
        (newOptions) => {
            // console.log('newOptions', newOptions)
            setTimeout(() => taskLoader.loadAndReplace(newOptions), 360)
        },
        { deep: true }
    )

    // @action 事件订阅
    viewContext.subscriber.subscribe('RefreshData', () => taskLoader.loadAndReplace())
    viewContext.subscriber.subscribe('UpdatePreference', () => {
        if (!viewContext.builtInProject.value || !viewContext.preference.value) return
        const newPreference = { ...viewContext.preference.value }
        newPreference.getTasksOptions.limit = taskLoader.states.pagination.limit
        // builtInProjectHandlers.updatePreference(
        //     tasksViewStore.user.states.profile?.email || 'default',
        //     builtInProject.value.id,
        //     newPreference
        // )
    })

    // @returns
    return { viewContext, tasks, taskLoader, initTable, handleUpdatePage, handleUpdatePerPage }
}

export default useTable
