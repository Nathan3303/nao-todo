import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useTasksLoader } from '../../../hooks'
import { useTasksStore } from '../../../stores'
import type { TableViewAdapterProps } from './types'

const useTableViewAdapter = (props: TableViewAdapterProps) => {
    /**
     * 页面加载状态 - 非表格
     * @description 用于控制进入表格时的加载状态，而不是下一页或刷新时的加载状态
     */
    const adapterLoading = ref(true)

    /**
     * 任务存储
     * 用于获取任务数据
     */
    const tasksStore = useTasksStore()

    /**
     * 待办任务加载器
     * 用于加载待办任务数据
     */
    const taskLoader = useTasksLoader(props.taskUseCase, props.getTasksOptions)

    /**
     * 任务数据
     * 从加载器的任务 ID 集合中获取任务数据
     */
    const tasks = computed(() => {
        const taskIds = [...taskLoader.states.taskIds]
        return taskIds.map((taskId) => tasksStore.getTask(taskId)!).filter(Boolean)
    })

    /**
     * 更新页码
     * 当页码变化时，更新加载器的分页信息并加载对应页数据
     * @param page 页码
     */
    const handleUpdatePage = (page: number) => {
        taskLoader.states.pagination.page = page
        taskLoader.loadAndReplace()
    }

    /**
     * 更新每页显示数量
     * 当每页显示数量变化时，更新加载器的分页信息并加载第一页数据
     * @param limit 每页显示数量
     */
    const handleUpdatePerPage = (limit: number) => {
        taskLoader.states.pagination.limit = limit
        handleUpdatePage(1)
    }

    /**
     * 新增任务 ID 事件订阅
     * 当新增任务 ID 事件触发时，将任务 ID 添加到加载器的任务 ID 集合中
     * @param taskId 任务 ID
     */
    const addNewTaskId = (taskId: string) => {
        taskLoader.states.taskIds.add(taskId)
        taskLoader.states.pagination.total += 1
    }

    /**
     * 刷新数据事件订阅（`RefreshData`）
     * @description **原地刷新**（`silent`）：同步拉取落库后触发的重载不得把已渲染内容换成加载态
     *              （`DEF-144` / AC-A1）。首次进入的 loading 由 `adapterLoading` 控制，不受影响（AC-A3）。
     */
    const refreshHandler = () => {
        void taskLoader.loadAndReplace(undefined, { silent: true })
    }

    /**
     * 组件挂载时
     * 1. 加载第一页数据
     * 2. 订阅刷新数据事件
     * 3. 订阅新增任务 ID 事件
     */
    onMounted(() => {
        taskLoader.loadFirstPage(true).finally(() => (adapterLoading.value = false))
        props.subscriber.subscribe('RefreshData', refreshHandler)
        props.subscriber.subscribe('AddNewTaskId', addNewTaskId)
    })

    /**
     * 组件卸载时
     * 1. 取消订阅刷新数据事件
     * 2. 取消订阅新增任务 ID 事件
     */
    onUnmounted(() => {
        props.subscriber.unsubscribe('RefreshData', refreshHandler)
        props.subscriber.unsubscribe('AddNewTaskId', addNewTaskId)
    })

    /**
     * 空状态信息
     */
    const noTaskError = computed(() => props.getNoTaskError())

    /**
     * 重试加载
     */
    const handleRetry = () => taskLoader.loadAndReplace()

    /**
     * 返回值
     * 包含任务数据、加载器、更新页码、更新每页显示数量方法
     */
    return {
        tasks,
        taskLoader,
        adapterLoading,
        loading: computed(() => taskLoader.states.loading),
        error: computed(() => taskLoader.states.error),
        /**
         * 原地刷新失败（`DEF-148`，非阻塞）
         * @description 有内容时只用提示条表达失败：**不得**把已渲染行换成错误分支；下轮成功自动消除
         */
        refreshError: computed(() => taskLoader.states.refreshError),
        noTaskError,
        handleUpdatePage,
        handleUpdatePerPage,
        handleRetry
    }
}

export default useTableViewAdapter