import { reactive, ref, watch, provide, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { isExpired } from '@nao-todo/utils'
import { useProjectStore, useTodoStore } from '@/stores'
import type { Todo } from '@nao-todo/types'
import type {
    TodoTableEmits,
    TodoTableProps,
    TodoTableContext,
    TodoTableMultiSelectPayload
} from './types'

export const useTodoTable = (props: TodoTableProps, emit: TodoTableEmits) => {
    const route = useRoute()
    const projectStore = useProjectStore()
    const todoStore = useTodoStore()

    const selectedId = ref<Todo['id']>()
    const sortInfo = reactive<TodoTableProps['sortOptions']>(props.sortOptions)
    const selectRange = reactive<TodoTableMultiSelectPayload['selectRange']>({
        start: -1,
        end: -1,
        original: -1
    })
    let unSubscribe: () => void

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
        selectRange.original = selectRange.start = selectRange.end = idx
        if (selectedId.value === todoId && taskId) return
        selectedId.value = todoId
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

    // 查找清单名称
    const getProjectNameByIdFromLocal = (projectId: string) => {
        const targetProject = projectStore.projects.find((p) => p.id === projectId)
        if (!targetProject) return
        return targetProject.title
    }

    // 根据路由中的待办 ID 获取表格下标
    const getIndexByTodoIdFromRoute = () => {
        const todoId = route.params.taskId as string
        return props.todos.findIndex((todo) => todo.id === todoId)
    }

    // 根据路由中的待办 ID 激活表格项
    const activeRowByTodoIdFromRoute = () => {
        const idx = getIndexByTodoIdFromRoute()
        if (idx === -1) {
            handleClearSelect(true)
            return
        }
        handleShowDetails(props.todos[idx].id, idx)
    }

    watch(
        () => sortInfo,
        (newValue) => emit('sortTodo', { ...newValue }),
        { deep: true }
    )

    onMounted(() => {
        activeRowByTodoIdFromRoute()
        unSubscribe = todoStore.$subscribe((mutation) => {
            if (mutation.type !== 'direct') return
            if (mutation.events.type === 'set') return
            // console.log(mutation);
            setTimeout(() => activeRowByTodoIdFromRoute())
        })
    })

    onBeforeUnmount(() => {
        if (unSubscribe) unSubscribe()
    })

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
        handleClearSortInfo,
        getProjectNameByIdFromLocal
    }
}
