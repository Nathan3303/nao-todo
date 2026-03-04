import useTasksLoader from '@/infrastructure/hooks/tasks-view/use-task-loader'
import type { TaskKanbanColumnProps } from './types'

const useKanbanColumn = (props: TaskKanbanColumnProps) => {
    // @states
    // const states = reactive<TaskKanbanColumnVO>({})

    // @hook Use tasks loader
    const { states, loadAndReplace, loadAndPush } = useTasksLoader(props.taskLister)

    // @method 首次加载处理函数
    const fetchTasks = async () => {
        states.pagination.page = 1
        states.isDone = true
        await loadAndReplace({ state: props.category })
        states.isDone = false
    }

    // @method 加载更多处理函数
    const loadMore = async () => {
        await loadAndPush({ state: props.category })
    }

    // @returns
    return {
        states,
        fetchTasks,
        loadMore
    }
}

export default useKanbanColumn
