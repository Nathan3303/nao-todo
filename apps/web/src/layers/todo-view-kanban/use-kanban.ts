import type { KanbanProps, KanbanTodos } from './types'
import { computed, onMounted, ref } from 'vue'
import type { Todo } from '@nao-todo/types'
import { useRouter } from 'vue-router'
import { useTodoStore } from '@/stores'

export const useKanban = (props: KanbanProps) => {
    const router = useRouter()
    const todoStore = useTodoStore()
    const loading = ref(true)

    const kanbanTodos = computed<KanbanTodos>(() => {
        const _todos: KanbanTodos = { todo: [], 'in-progress': [], done: [] }
        for (const todo of todoStore.todos) {
            _todos[todo.state].push(todo)
        }
        return _todos
    })

    const showTodoDetails = async (todoId: Todo['id']) => {
        const name = props.baseRoute as string
        const params = { taskId: todoId }
        await router.push({ name, params })
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
