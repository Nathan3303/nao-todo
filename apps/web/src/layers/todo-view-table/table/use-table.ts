import { reactive, ref, watch, provide } from 'vue'
import { useRoute } from 'vue-router'
import { isExpired } from '@nao-todo/utils'
import type { Todo } from '@nao-todo/types'
import type {
    TodoTableEmits,
    TodoTableProps,
    TodoTableContext,
    TodoTableMultiSelectPayload
} from './types'

export const useTodoTable = (props: TodoTableProps, emit: TodoTableEmits) => {
    const route = useRoute()

    const selectedId = ref<Todo['id']>()
    const sortInfo = reactive<TodoTableProps['sortOptions']>(props.sortOptions)
    const selectRange = reactive<TodoTableMultiSelectPayload['selectRange']>({
        start: -1,
        end: -1,
        original: -1
    })

    const isTodoExpired = (todo: Todo) => {
        const endAt = (todo.dueDate.endAt || '') as string
        return isExpired(endAt) && todo.state !== 'done'
    }

    const handleDeleteBtnClk = (todoId: Todo['id'], isDeleted: boolean) => {
        if (isDeleted) {
            handleRestore(todoId)
        } else {
            handleDelete(todoId)
        }
    }

    const handleDelete = (todoId: Todo['id']) => {
        if (props.simple) return
        emit('deleteTodo', todoId)
    }

    const handleRestore = (todoId: Todo['id']) => {
        if (props.simple) return
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
        if (props.simple) return
        selectedId.value = void 0
    }

    const handleClearSelect = (fullClear: boolean = false) => {
        handleClearSelectedId()
        if (fullClear) selectRange.original = -1
        selectRange.start = selectRange.original
        selectRange.end = selectRange.original
    }

    const handleClearSortInfo = () => {
        sortInfo.field = ''
        sortInfo.order = 'asc'
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
        sortOptions: sortInfo
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
