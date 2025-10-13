import { ref, watch, computed } from 'vue'
import { defineStore } from 'pinia'
import { storeToRefs } from 'pinia'
import { useRouter, useRoute } from 'vue-router'
import { useTasksDataStore, useTasksViewStore } from '@/stores/tasks'
import { unwrapError } from '@nao-todo/utils'
import type { GetTodosSortOptions } from '@nao-todo/types'

const useTasksBasicViewStore = defineStore('TasksBasicViewStore', () => {
    // Router & Stores
    const tasksDataStore = useTasksDataStore()
    const tasksViewStore = useTasksViewStore()
    const router = useRouter()
    const route = useRoute()

    // @states 前置状态数据
    const { viewProps, responsiveFlag } = storeToRefs(tasksViewStore)
    const { todos, pagination, tags } = storeToRefs(tasksDataStore)

    // @state 分页页码
    const page = ref<number>(1)

    // @states 加载态以及加载失败错误信息
    const loading = ref<boolean>(false)
    const error = ref<string>('')

    // @state 侦听信息标记 - 用于避免无效的重复请求
    // const loadMark = ref<string>('')

    // @method 加载待办任务数据
    const getTodos = async (useLoading: boolean = false): Promise<boolean> => {
        // 判断 viewProps 是否存在
        if (!viewProps.value) return false
        // 重置加载状态
        loading.value = useLoading && true
        // 调用 API 请求数据
        const err = await tasksDataStore.getTodos({
            page: page.value,
            limit: 20,
            ...viewProps.value.preference.getTodosOptions
        })
        loading.value = useLoading && false
        // 处理失败结果
        if (err) {
            error.value = unwrapError(err)
            return false
        }
        // 处理成功结果
        error.value = ''
        return true
    }

    // @watch 当相关数据变化时获取待办任务数据
    watch(
        () => viewProps.value?.id,
        async () => {
            // 判断路由分类是否是 basic，不是则置空 loadMark
            if (route.meta.category !== 'basic') {
                //     loadMark.value = ''
                return
            }
            // 构建 newLoadMark
            // const newLoadMark = `${newId}`
            // console.log(route.meta.category, loadMark.value, '->', newLoadMark)
            // 判断 loadMark 是否相同
            // if (newLoadMark === loadMark.value) return
            // 请求数据
            await getTodos(true)
            // 处理失败结果
            // if (!ok) return
            // 记录 newLoadMark
            // loadMark.value = newLoadMark
        },
        { immediate: true }
    )

    // @method 查看待办任务详细信息
    const showTodoDetails = async (id: string) => {
        await router.push({ name: 'tasks-basic-main', params: { todoId: id as string } })
    }

    // @method 处理分页每页记录数变化
    const handleUpdatePerPage = (limit: number) => {
        if (!viewProps.value) return
        viewProps.value.preference.getTodosOptions.limit = limit
        page.value = 1
        getTodos()
    }

    // @method 处理分页页码变化
    const handleUpdatePage = (newPage: number) => {
        page.value = newPage
        getTodos()
    }

    // @method 处理排序数据变化
    const handleUpdateSortOptions = (newSortOptions: GetTodosSortOptions | null) => {
        if (!viewProps.value) return
        viewProps.value.preference.getTodosOptions.sort = newSortOptions || void 0
        getTodos(true)
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
    const handleHideCompleted = () => {
        if (!viewProps.value) return
        viewProps.value.preference.getTodosOptions.state = isHideCompletedAlready.value
            ? void 0
            : 'todo,in-progress'
        getTodos()
    }

    // @method 处理切换视图
    const handleSwitchView = (viewType: string) => {
        if (loading.value) return
        tasksViewStore.switchView(viewType)
        router.push({ name: 'tasks-basic-main', params: { viewType } })
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
        getTodos,
        showTodoDetails,
        handleUpdatePage,
        handleUpdatePerPage,
        handleUpdateSortOptions,
        handleClearSortOptions: () => handleUpdateSortOptions(null),
        deleteTodo: tasksDataStore.deleteTodo,
        restoreTodo: tasksDataStore.restoreTodo,
        handleRefreshData,
        handleHideCompleted,
        handleSwitchToTable: () => handleSwitchView('table'),
        handleSwitchToList: () => handleSwitchView('list'),
        handleSwitchToKanban: () => handleSwitchView('kanban')
    }
})

export default useTasksBasicViewStore
