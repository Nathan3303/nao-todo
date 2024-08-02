import { ref } from 'vue'
import type { Todo } from '@/stores'
import type { TodoTableEmits, TodoTableProps } from './types'

export const useTodoTable = (props: TodoTableProps, emit: TodoTableEmits) => {
    const selectedId = ref<Todo['id']>()

    const handleDeleteBtnClk = (todoId: Todo['id'], isDeleted: boolean) => {
        if (isDeleted) {
            handleRestore(todoId)
        } else {
            handleDelete(todoId)
        }
    }

    const handleDelete = (todoId: Todo['id']) => {
        const { simple } = props
        if (simple) {
            return
        }
        emit('deleteTodo', todoId)
    }

    const handleRestore = (todoId: Todo['id']) => {
        const { simple } = props
        if (simple) {
            return
        }
        emit('restoreTodo', todoId)
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
        handleDeleteBtnClk,
        handleDelete,
        handleRestore,
        handleShowDetails,
        handleClearSelectedId
    }
}
