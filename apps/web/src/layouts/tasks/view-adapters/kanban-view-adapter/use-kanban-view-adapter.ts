import { useTasksStore } from '@/stores/tasks'
import type { KanbanViewAdapterProps } from './types'
import useTasksLoader from '@/infrastructure/hooks/tasks-view/use-task-loader'
import { computed, onMounted, onUnmounted, watch } from 'vue'

const useKanbanViewAdapter = (props: KanbanViewAdapterProps) => {
    const tasksStore = useTasksStore()
    const taskLoader = useTasksLoader(props.taskUseCase, props.getTasksOptions)

    const tasks = computed(() =>
        [...taskLoader.states.taskIds].map((taskId) => tasksStore.getTask(taskId)!).filter(Boolean)
    )

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

    return {
        tasks,
        taskLoader,
        loading: computed(() => taskLoader.states.loading),
        error: computed(() => taskLoader.states.error),
        viewProps: computed(() => ({
            preference: {
                columns: props.columns,
                getTodosOptions: props.getTasksOptions
            }
        }))
    }
}

export default useKanbanViewAdapter
