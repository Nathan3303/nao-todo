import { ref } from 'vue'
import type { Todo } from '@/stores'
import type { TodoTableEmits, TodoTableProps } from './types'

export const useTodoTable = (props: TodoTableProps, emit: TodoTableEmits) => {
    const selectedId = ref<Todo['id']>()

    const handleDelete = (todoId: Todo['id']) => {
        const { simple } = props
        if (simple) {
            return
        }
        emit('deleteTodo', todoId)
    }

    const handleShowDetails = (todoId: Todo['id']) => {
        if (selectedId.value === todoId) {
            return
        }
        selectedId.value = todoId
        emit('showTodoDetails', todoId)
    }

    const handleClearSelectedId = () => {
        const { simple } = props
        if (simple) {
            return
        }
        selectedId.value = void 0
    }

    return {
        selectedId,
        handleDelete,
        handleShowDetails,
        handleClearSelectedId
    }
}
