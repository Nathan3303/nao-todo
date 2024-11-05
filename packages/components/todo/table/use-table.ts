import { reactive, ref, watch, provide } from 'vue'
import { useRoute } from 'vue-router'
import { isExpired } from '@nao-todo/handlers/date-handlers'
import type { Todo } from '@nao-todo/stores'
import type { TodoTableEmits, TodoTableProps, TodoTableContext } from './types'

export const useTodoTable = (props: TodoTableProps, emit: TodoTableEmits) => {
    const route = useRoute()

    const selectedId = ref<Todo['id']>()
    const selectRange = reactive({ start: -1, end: -1, original: -1 })
    const sortInfo = reactive(props.sortInfo)

    const isTodoExpired = (todo: (typeof props.todos)[0]) => {
        return isExpired(todo.dueDate.endAt) && !todo.isDone && todo.state !== 'done'
    }

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
        selectRange.original = selectRange.start = selectRange.end = idx
        emit('showTodoDetails', todoId)
    }

    const handleMultiSelect = (idx: number) => {
        if (selectRange.original === -1 || selectRange.original === idx) return
        if (selectRange.original > idx) {
            selectRange.start = idx
            selectRange.end = selectRange.original
        } else {
            selectRange.start = selectRange.original
            selectRange.end = idx
        }
        const selectedIds = props.todos
            .slice(selectRange.start, selectRange.end + 1)
            .map((todo) => todo.id)
        emit('multiSelect', { selectedIds, selectRange })
        selectedId.value = void 0
    }

    const handleClearSelectedId = () => {
        const { simple } = props
        if (simple) return
        selectedId.value = void 0
    }

    const handleClearSelect = (fullClear: boolean = false) => {
        handleClearSelectedId()
        if (fullClear) selectRange.original = -1
        selectRange.start = selectRange.original
        selectRange.end = selectRange.original
        // emit('multiSelect', { selectedIds: [], selectRange })
    }

    const handleClearSortInfo = () => {
        sortInfo.field = ''
        sortInfo.order = ''
    }

    watch(
        () => props.todos,
        () => handleClearSelect(true)
    )

    watch(
        () => sortInfo,
        (newValue) => emit('sortTodo', { ...newValue }),
        { deep: true }
    )

    provide<TodoTableContext>('TodoTableContext', {
        showDetailsHandler: handleShowDetails,
        sortInfo: sortInfo
    })

    return {
        selectedId,
        selectRange,
        isTodoExpired,
        handleDeleteBtnClk,
        handleDelete,
        handleRestore,
        handleShowDetails,
        handleMultiSelect,
        handleClearSelectedId,
        handleClearSelect,
        handleClearSortInfo
    }
}
