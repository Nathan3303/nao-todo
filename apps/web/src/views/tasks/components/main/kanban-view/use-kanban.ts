import type { KanbanTodos } from './types'
import { computed, onMounted, ref } from 'vue'
import type { Todo } from '@nao-todo/types'
import { useRouter } from 'vue-router'
import { useTodoStore } from '@/stores'
import { useTasksViewStore } from '../../../stores'
import { storeToRefs } from 'pinia'

export const useKanban = () => {
    const router = useRouter()
    const todoStore = useTodoStore()
    const tasksViewStore = useTasksViewStore()
    const loading = ref(true)

    const { viewInfo, category } = storeToRefs(tasksViewStore)

    const baseRoute = computed(() => {
        switch (category.value) {
            case 'basic':
                return `tasks-${viewInfo.value?.id}-kanban`
            case 'project':
                return `tasks-project-kanban`
            case 'tag':
                return `tasks-tag-kanban`
            default:
                return `tasks-all-kanban`
        }
    })

    const kanbanTodos = computed<KanbanTodos>(() => {
        const _todos: KanbanTodos = { todo: [], 'in-progress': [], done: [] }
        for (const todo of todoStore.todos) {
            _todos[todo.state].push(todo)
        }
        return _todos
    })

    const showTodoDetails = async (todoId: Todo['id']) => {
        await router.push({ name: baseRoute.value, params: { taskId: todoId } })
    }

    const handleFinishTodo = async (todoId: Todo['id']) => {
        await todoStore.doUpdateTodo(todoId, { state: 'done' })
    }

    const handleUnfinishTodo = async (todoId: Todo['id']) => {
        await todoStore.doUpdateTodo(todoId, { state: 'todo' })
    }

    onMounted(() => {
        loading.value = true
        todoStore.deleteAllLocalTodos()
        loading.value = false
    })

    return {
        kanbanTodos,
        loading,
        showTodoDetails,
        handleFinishTodo,
        handleUnfinishTodo
    }
}
