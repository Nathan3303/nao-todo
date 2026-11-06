import { useTasksStore } from '../../../stores'
import type { ListViewAdapterProps } from './types'
import { useTasksLoader } from '../../../hooks'
import { computed, onMounted, onUnmounted, ref } from 'vue'

const useListViewAdapter = (props: ListViewAdapterProps) => {
    // @dataStore
    const tasksStore = useTasksStore()

    // @ref 视图刷新状态
    const viewLoading = ref(true)

    // @hook 待办任务加载器
    const taskLoader = useTasksLoader(props.taskUseCase, props.getTasksOptions)

    // @state 任务数据
    const tasks = computed(() =>
        [...taskLoader.states.taskIds].map((taskId) => tasksStore.getTask(taskId)!).filter(Boolean)
    )

    // @state 排序选项
    const sortOptions = computed(() => {
        return props.getTasksOptions.sort || { field: 'createdAt', order: 'desc' }
    })

    // @method 下一页
    const handleNextPage = () => {
        // taskLoader.states.pagination.page++
        // taskLoader.loadAndPush()
        taskLoader.loadNextPage(false)
    }

    // @method 新增任务 ID 事件订阅
    const addNewTaskId = (taskId: string) => taskLoader.states.taskIds.add(taskId)

    // @method 刷新数据事件订阅
    // @description **原地刷新**（`silent`）：同步拉取落库后的重载不得把已渲染内容换成加载态
    //              （`DEF-144` / AC-A1）；首次进入的 loading 仍由 `viewLoading` 正常控制（AC-A3）。
    const refreshHandler = () => {
        void taskLoader.loadFirstPage(true, { silent: true })
    }

    // @onMounted
    onMounted(() => {
        taskLoader.loadFirstPage(true).then(() => (viewLoading.value = false))
        props.subscriber.subscribe('RefreshData', refreshHandler)
        props.subscriber.subscribe('AddNewTaskId', addNewTaskId)
    })

    // @onUnmounted
    onUnmounted(() => {
        props.subscriber.unsubscribe('RefreshData', refreshHandler)
        props.subscriber.unsubscribe('AddNewTaskId', addNewTaskId)
    })

    // @state 空状态信息
    const noTaskError = computed(() => props.getNoTaskError())

    // @method 重试加载
    const handleRetry = () => taskLoader.loadAndReplace()

    // @returns
    return {
        tasks,
        taskLoader,
        loading: computed(() => taskLoader.states.loading),
        /** 原地刷新失败（`DEF-148`，非阻塞：内容保留 + 提示条；下轮成功自动消除） */
        /** `null` = 无失败；`''` = 失败但无可读原因（`T665`：显示判据 = `!== null`） */
        refreshError: computed(() => taskLoader.states.refreshError),
        sortOptions,
        error: computed(() => taskLoader.states.error),
        noTaskError,
        handleNextPage,
        handleRetry,
        viewLoading
    }
}

export default useListViewAdapter