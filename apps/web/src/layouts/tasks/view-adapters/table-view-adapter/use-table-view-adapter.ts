import { computed, inject, onMounted, onUnmounted } from 'vue'
import useTasksLoader from '@/infrastructure/hooks/use-task-loader'
import { useTasksStore } from '@/stores'
import type { TableViewAdapterProps } from './types'
import { IndexViewContext } from '@/views/index/index-view'
import { INDEX_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'

const useTableViewAdapter = (props: TableViewAdapterProps) => {
    /**
     * 视图上下文
     */
    const { dialogManager } = inject<IndexViewContext>(INDEX_VIEW_CONTEXT_KEY)!

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
     * 监听获取选项变化
     * 当获取选项变化时，调用加载器加载第一页数据
     */
    // watch(
    //     () => props.getTasksOptions,
    //     (newOptions) => taskLoader.loadAndReplace(newOptions),
    //     { deep: true }
    // )

    /**
     * 组件挂载时
     * 1. 加载第一页数据
     * 2. 订阅刷新数据事件
     * 3. 订阅新增任务 ID 事件
     */
    onMounted(() => {
        taskLoader.loadFirstPage(true)
        props.subscriber.subscribe('RefreshData', taskLoader.loadAndReplace)
        props.subscriber.subscribe('AddNewTaskId', addNewTaskId)
    })

    /**
     * 组件卸载时
     * 1. 取消订阅刷新数据事件
     * 2. 取消订阅新增任务 ID 事件
     */
    onUnmounted(() => {
        props.subscriber.unsubscribe('RefreshData', taskLoader.loadAndReplace)
        props.subscriber.unsubscribe('AddNewTaskId', addNewTaskId)
    })

    /**
     * 返回值
     * 包含任务数据、加载器、更新页码、更新每页显示数量方法
     */
    return {
        tasks,
        taskLoader,
        error: computed(() => taskLoader.states.error),
        handleUpdatePage,
        handleUpdatePerPage,
        dialogManager,
    }
}

export default useTableViewAdapter

