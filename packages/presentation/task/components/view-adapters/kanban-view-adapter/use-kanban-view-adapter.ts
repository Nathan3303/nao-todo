import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useTasksLoader } from '../../../hooks'
import { useTasksStore } from '../../../stores'
import type { KanbanViewAdapterProps } from './types'

/**
 * 看板视图适配器 Hook
 * @param props 看板视图适配器 props
 */
const useKanbanViewAdapter = (props: KanbanViewAdapterProps) => {
    /**
     * 任务存储
     */
    const tasksStore = useTasksStore()

    /**
     * 任务加载器
     */
    const taskLoader = useTasksLoader(props.taskUseCase, props.getTasksOptions)

    /**
     * 任务列表
     * @description 根据任务加载器返回的任务 ID 列表，从任务存储中获取任务对象
     */
    const tasks = computed(() => {
        const taskIds = [...taskLoader.states.taskIds]
        return taskIds.map((taskId) => tasksStore.getTask(taskId)!).filter(Boolean)
    })

    /**
     * 排序选项代理
     * @description 从任务加载器获取排序选项，默认按创建时间降序
     */
    const sortOptions = computed(() => {
        return props.getTasksOptions.sort || { field: 'createdAt', order: 'desc' }
    })

    /**
     * 添加新任务 ID 到任务加载器
     * @param taskId 新任务 ID
     */
    const addNewTaskId = (taskId: string) => taskLoader.states.taskIds.add(taskId)

    watch(
        () => props.getTasksOptions,
        (newOptions) => taskLoader.loadAndReplace(newOptions),
        { deep: true }
    )

    onMounted(() => {
        taskLoader.loadFirstPage(true)
        props.subscriber.subscribe('RefreshData', taskLoader.loadAndReplace)
        props.subscriber.subscribe('AddNewTaskId', addNewTaskId)
    })

    onUnmounted(() => {
        props.subscriber.unsubscribe('RefreshData', taskLoader.loadAndReplace)
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

    // @returns
    return {
        tasks,
        sortOptions,
        taskLoader,
        loading: computed(() => taskLoader.states.loading),
        error: computed(() => taskLoader.states.error),
        noTaskError,
        viewProps: computed(() => ({
            preference: {
                columns: props.columns,
                getTodosOptions: props.getTasksOptions
            }
        })),
        handleRetry
    }
}

export default useKanbanViewAdapter