import { ref, computed } from 'vue'
import { storeToRefs, defineStore } from 'pinia'
import { useRouter } from 'vue-router'
import { useTasksDataStore, useTasksViewStore, useTasksDialogStore } from '@/stores/tasks'
import type { GetTodosSortOptions } from '@nao-todo/types'

const useTasksTagViewStore = defineStore('TasksTagViewStore', () => {
    // Router & Stores
    const tasksDataStore = useTasksDataStore()
    const tasksViewStore = useTasksViewStore()
    const tasksDialogStore = useTasksDialogStore()
    const router = useRouter()

    // @states 前置状态数据
    const { viewProps, responsiveFlag } = storeToRefs(tasksViewStore)
    const { todos, pagination, tags } = storeToRefs(tasksDataStore)

    // @state 分页页码
    // const page = ref<number>(1)

    // @states 加载态以及加载失败错误信息
    const loading = ref<boolean>(false)
    const error = ref<string>('')

    // @method 查看待办任务详细信息
    const showTodoDetails = async (id: string) => {
        await router.push({ name: 'tasks-tag-main', params: { todoId: id as string } })
    }

    // @method 处理排序数据变化
    const handleUpdateSortOptions = (newSortOptions: GetTodosSortOptions | null) => {
        if (!viewProps.value) return
        viewProps.value.preference.getTodosOptions.sort = newSortOptions || void 0
    }

    // @state 上一次重新加载时间以及允许重新加载状态（五秒等待时间）
    const reloadTimer = ref<number | null>(null)
    const allowReload = ref<boolean>(true)

    // @method 处理重新获取待办任务数据
    const handleRefreshData = async () => {
        loading.value = true
        if (reloadTimer.value) {
            loading.value = false
            return
        }
        await tasksViewStore.refreshData()
        reloadTimer.value = setTimeout(() => {
            reloadTimer.value = null
            allowReload.value = true
        }, 5000)
        loading.value = false
        allowReload.value = false
    }

    // @computed 是否已是隐藏了已完成任务
    const isHideCompletedAlready = computed(() => {
        if (!viewProps.value) return false
        const state = viewProps.value.preference.getTodosOptions.state
        return state === 'todo,in-progress' || state === 'todo,doing'
    })

    // @method 处理隐藏已完成
    const handleHideCompleted = async () => {
        if (!viewProps.value) return
        viewProps.value.preference.getTodosOptions.state = isHideCompletedAlready.value
            ? void 0
            : 'todo,in-progress'
    }

    // @method 处理切换视图
    const handleSwitchView = (viewType: string) => {
        if (loading.value) return
        tasksViewStore.switchView(viewType)
        router.push({ name: 'tasks-tag-main', params: { viewType } })
    }

    // @returns
    return {
        viewProps,
        responsiveFlag,
        loading,
        error,
        todos,
        pagination,
        tags,
        showTodoDetails,
        deleteTodo: tasksDataStore.deleteTodo,
        restoreTodo: tasksDataStore.restoreTodo,
        handleUpdateSortOptions,
        handleClearSortOptions: () => handleUpdateSortOptions(null),
        handleSwitchToTable: () => handleSwitchView('table'),
        handleSwitchToList: () => handleSwitchView('list'),
        handleSwitchToKanban: () => handleSwitchView('kanban'),
        allowReload,
        handleRefreshData,
        isHideCompletedAlready,
        handleHideCompleted,
        handleUpdatePreference: tasksViewStore.updatePreference,
        handleDelete: () => tasksDataStore.deleteTag(viewProps.value!.id),
        handleUpdateColor: () => tasksDialogStore.tagColorUpdater?.open(viewProps.value!.id)
    }
})

export default useTasksTagViewStore
