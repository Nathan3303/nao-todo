import { ref, watch, computed } from 'vue'
import { defineStore } from 'pinia'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useTasksDataStore, useTasksViewStore } from '@/stores/tasks'
import { unwrapError } from '@nao-todo/utils'
import type { GetTodosSortOptions } from '@nao-todo/types'

const useTasksMainProjectStore = defineStore('TasksMainProjectStore', () => {
    // Router & Stores
    const tasksDataStore = useTasksDataStore()
    const tasksViewStore = useTasksViewStore()
    const router = useRouter()

    // @states 前置状态数据
    const { viewProps, responsiveFlag } = storeToRefs(tasksViewStore)
    const { todos, pagination, tags } = storeToRefs(tasksDataStore)

    // @state 分页页码
    const page = ref<number>(1)

    // @states 加载态以及加载失败错误信息
    const loading = ref<boolean>(false)
    const error = ref<string>('')

    // @state 当前加载清单 ID 记录 - 避免重复加载某些信息
    // const iProjectId = ref<Project['id']>()

    // @watch 当 viewProps 中相关数据变化时获取数据
    watch(
        () => [viewProps.value?.readyState, page.value] as const,
        async ([newReadyState, newPage]) => {
            // 判断 newReadyState 是否为 3
            if (newReadyState !== 3) return
            // 判断 viewProps 是否存在
            if (!viewProps.value) return
            // 判断 viewProps.category 是否是 'project'
            if (viewProps.value.category !== 'project') return
            // 判断清单 Id 是否相同
            // if (iProjectId.value === newId) return
            // 重置加载状态
            loading.value = true
            error.value = ''
            // 调用 API 请求数据
            const newGetTodosOptions = {
                limit: 20,
                projectId: viewProps.value.id,
                ...viewProps.value.preference.getTodosOptions
            }
            const err = await tasksDataStore.getTodos({
                page: newPage,
                ...newGetTodosOptions
            })
            loading.value = false
            // 处理失败结果
            if (err) {
                error.value = unwrapError(err)
                return
            }
            // 保存清单偏好（记录在清单数据中，以便偏好更新时直接传输）
            viewProps.value.preference.getTodosOptions = newGetTodosOptions
            // 记录已请求的清单 Id，避免重复请求
            // iProjectId.value = viewProps.value.id
        },
        { immediate: true }
    )

    // @watch 监听 todos 变化，当 todos 为空时改变 error 值
    watch(
        () => todos.value,
        (newVal) => {
            // 判断待办结果是否为空
            if (newVal.length === 0) {
                error.value = '当前暂无待办'
                return
            }
            // 处理成功结果
            error.value = ''
        },
        { deep: true, immediate: true }
    )

    // @method 查看待办任务详细信息
    const showTodoDetails = async (id: string) => {
        await router.push({ name: 'tasks-project', params: { todoId: id as string } })
    }

    // @method 处理分页每页记录数变化
    const handleUpdatePerPage = (limit: number) => {
        if (!viewProps.value) return
        page.value = 1
        viewProps.value.preference.getTodosOptions.limit = limit
    }

    // @method 处理排序数据变化
    const handleUpdateSortOptions = (newSortOptions: GetTodosSortOptions | null) => {
        if (!viewProps.value) return
        if (newSortOptions === null) {
            viewProps.value.preference.getTodosOptions.sort = void 0
            return
        }
        viewProps.value.preference.getTodosOptions.sort = newSortOptions
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
        if (isHideCompletedAlready.value) return
        viewProps.value.preference.getTodosOptions.state = 'todo,in-progress'
        await tasksViewStore.refreshData()
    }

    // @returns
    return {
        responsiveFlag,
        todos,
        pagination,
        tags,
        loading,
        error,
        page,
        viewProps,
        allowReload,
        isHideCompletedAlready,
        showTodoDetails,
        handleUpdatePerPage,
        handleUpdateSortOptions,
        handleClearSortOptions: () => handleUpdateSortOptions(null),
        deleteTodo: tasksDataStore.deleteTodo,
        restoreTodo: tasksDataStore.restoreTodo,
        handleRefreshData,
        handleHideCompleted,
        handleSwitchToTable: () => tasksViewStore.switchView('table'),
        handleSwitchToList: () => tasksViewStore.switchView('list'),
        handleSwitchToKanban: () => tasksViewStore.switchView('kanban'),
        handleUpdatePreference: tasksViewStore.updatePreference,
        handleDelete: () => tasksDataStore.deleteProject(viewProps.value!.id)
    }
})

export default useTasksMainProjectStore
