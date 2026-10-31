import type { TaskViewObject } from '@nao-todo/domain-task'
import { computed, reactive } from 'vue'
import { normalizeKanbanPriority } from './constants'
import type { TaskKanbanColumnProps } from './types'

const useKanbanColumn = (props: TaskKanbanColumnProps) => {
    const states = reactive({
        tasks: [] as TaskViewObject[],
        loading: false,
        error: '',
        isDone: true,
        pagination: { page: 1 }
    })

    // @computed 列内容：按分组方式分流（state ⇒ 状态列；priority ⇒ 优先级列，脏值归「低」）
    const columnTasks = computed(() =>
        props.tasks.filter((task) =>
            props.groupBy === 'priority'
                ? normalizeKanbanPriority(task.priority) === props.category
                : task.state === props.category
        )
    )

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