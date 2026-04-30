import { useTasksStore } from '@/stores/tasks'
import type { ListViewAdapterProps } from './types'
import useTasksLoader from '@/infrastructure/hooks/use-task-loader'
import { computed, onMounted, onUnmounted } from 'vue'

const useListViewAdapter = (props: ListViewAdapterProps) => {
    // @dataStore
    const tasksStore = useTasksStore()

    // @hook 待办任务加载器
    const taskLoader = useTasksLoader(props.taskUseCase, props.getTasksOptions)

    // @state 任务数据
    const tasks = computed(() =>
        [...taskLoader.states.taskIds].map((taskId) => tasksStore.getTask(taskId)!).filter(Boolean)
    )

    // @method 下一页
    const handleNextPage = () => {
        taskLoader.states.pagination.page++
        taskLoader.loadAndPush()
    }

    // @method 新增任务 ID 事件订阅
    const addNewTaskId = (taskId: string) => taskLoader.states.taskIds.add(taskId)

    // @method 刷新数据事件订阅
    const refreshHandler = () => {
        taskLoader.loadFirstPage(true)
    }

    // @onMounted
    onMounted(() => {
        taskLoader.loadFirstPage(true)
        props.subscriber.subscribe('RefreshData', refreshHandler)
        props.subscriber.subscribe('AddNewTaskId', addNewTaskId)
    })

    // @onUnmounted
    onUnmounted(() => {
        props.subscriber.unsubscribe('RefreshData', refreshHandler)
        props.subscriber.unsubscribe('AddNewTaskId', addNewTaskId)
    })

    // @returns
    return {
        tasks,
        taskLoader,
        handleNextPage
    }
}

export default useListViewAdapter

