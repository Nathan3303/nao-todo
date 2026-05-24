import { computed, reactive } from 'vue'
import type { TaskKanbanColumnProps } from './types'
import type { TaskViewObject } from '@nao-todo/types'

const useKanbanColumn = (props: TaskKanbanColumnProps) => {
    const states = reactive({
        tasks: [] as TaskViewObject[],
        loading: false,
        error: '',
        isDone: true,
        pagination: { page: 1 }
    })

    const columnTasks = computed(() => props.tasks.filter((task) => task.state === props.category))

    const fetchTasks = async () => {
        states.loading = true
        states.error = ''
        states.tasks = columnTasks.value
        states.loading = false
        states.isDone = true
    }

    const loadMore = async () => {}

    return {
        states,
        columnTasks,
        fetchTasks,
        loadMore
    }
}

export default useKanbanColumn

