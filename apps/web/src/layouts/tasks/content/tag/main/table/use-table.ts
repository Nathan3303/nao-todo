import { TAG_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { TagViewContext } from '../../types'
import { inject, watch } from 'vue'
import useTasksLoader from '@/infrastructure/hooks/tasks-view/use-task-loader'
import { useTasksViewStore } from '@/views/index/tasks'

const useTable = () => {
    // @context
    const viewContext = inject<TagViewContext>(TAG_VIEW_CONTEXT_KEY)

    // @store
    const tasksViewStore = useTasksViewStore()

    // @hook 待办任务加载器
    const taskLoader = useTasksLoader(tasksViewStore.taskApp, {
        ...viewContext?.preference.value?.getTasksOptions
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
        () => viewContext?.preference.value?.getTasksOptions,
        (newOptions) => {
            // console.log('newOptions', newOptions)
            setTimeout(() => taskLoader.loadAndReplace(newOptions), 360)
        },
        { deep: true }
    )

    // @action 事件订阅
    viewContext?.subscriber.subscribe('RefreshData', () => taskLoader.loadAndReplace())
    viewContext?.subscriber.subscribe('UpdatePreference', () => {
        if (!viewContext?.tag.value || !viewContext.preference.value) return
        const newPreference = { ...viewContext.preference.value }
        newPreference.getTasksOptions.limit = taskLoader.states.pagination.limit
        tasksViewStore.tagApp.updatePreference(viewContext?.tag.value.id, newPreference)
    })

    // @returns
    return {
        viewContext,
        taskLoader,
        initTable,
        handleUpdatePage,
        handleUpdatePerPage
    }
}

export default useTable
