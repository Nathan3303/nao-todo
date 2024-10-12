import { reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { Todo } from '@/stores'
import type { TodoTableEmits, TodoTableProps } from './types'

export const useTodoTable = (props: TodoTableProps, emit: TodoTableEmits) => {
    const route = useRoute()
    const selectedId = ref<Todo['id']>()
    const selectRange = reactive({ start: -1, end: -1 })

    const handleDeleteBtnClk = (todoId: Todo['id'], isDeleted: boolean) => {
        if (isDeleted) {
            handleRestore(todoId)
        } else {
            handleDelete(todoId)
        }
    }

    const handleDelete = (todoId: Todo['id']) => {
        const { simple } = props
        if (simple) return
        emit('deleteTodo', todoId)
    }

    const handleRestore = (todoId: Todo['id']) => {
        const { simple } = props
        if (simple) return
        emit('restoreTodo', todoId)
    }

    const handleShowDetails = (todoId: Todo['id'], idx: number) => {
        const taskId = route.params.taskId
        if (selectedId.value === todoId && taskId) return
        selectedId.value = todoId
        selectRange.start = selectRange.end = idx
        emit('showTodoDetails', todoId)
    }

    const handleMultiSelect = (idx: number) => {
        if (selectRange.start === -1 || selectRange.start === idx) return
        if (selectRange.start > idx) {
            selectRange.end = selectRange.start
            selectRange.start = idx
        } else {
            selectRange.end = idx
        }
        const selectedIds = props.todos
            .slice(selectRange.start, selectRange.end + 1)
            .map((todo) => todo.id)
        emit('multiSelect', { selectedIds, selectRange })
    }

    const handleClearSelectedId = () => {
        const { simple } = props
        if (simple) return
        selectedId.value = void 0
    }

    return {
        selectedId,
        selectRange,
        handleDeleteBtnClk,
        handleDelete,
        handleRestore,
        handleShowDetails,
        handleMultiSelect,
        handleClearSelectedId
    }
}
