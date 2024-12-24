import { storeToRefs } from 'pinia'
import { useTagStore, useTodoStore } from '@/stores'
import { ref, shallowRef, watch } from 'vue'
import type {
    GetTodosOptions,
    GetTodosResponseData,
    ResponseData,
    Todo,
    TodoColumnOptions
} from '@nao-todo/types'
import { getTodos, updateTodo, updateTodos } from '@nao-todo/apis'
import { useMoment } from '@nao-todo/utils'
import { NueConfirm, NueMessage } from 'nue-ui'

export const useHistoryDialog = () => {
    const { tags } = storeToRefs(useTagStore())

    const visible = ref(false)
    const tableLoading = ref(true)
    const todos = ref<Todo[]>([])
    const getOptions = shallowRef<GetTodosOptions>({
        relativeDate: '-today',
        state: 'todo,in-progress',
        sort: { field: 'endAt', order: 'desc' },
        page: 1,
        limit: 99
    })
    const columnOptions = ref<TodoColumnOptions>({
        description: false,
        state: true,
        priority: true,
        endAt: true,
        createdAt: false,
        updatedAt: false,
        project: true
    })
    const filterInputValue = ref('')

    const getExpiredTodos = async () => {
        const response = await getTodos(getOptions.value)
        // console.log(response.data)
        if (response.code === 20000) {
            const responseData = response.data as GetTodosResponseData
            todos.value = responseData.todos
        }
    }

    const getExpiredTodosWithLoading = async () => {
        tableLoading.value = true
        await getExpiredTodos()
        tableLoading.value = false
        return todos.value.length
    }

    const setTodoEndAtToToday = async (todo: Todo) => {
        const endOfDay = useMoment().endOf('d').toISOString(true)
        const newDueDate = { startAt: todo.dueDate.startAt, endAt: endOfDay }
        NueConfirm({
            title: '顺延任务至今天',
            content: '确认将此任务顺延至今天吗？',
            confirmButtonText: '确认',
            cancelButtonText: '取消',
            onConfirm: async () => await updateTodo(todo.id, { dueDate: newDueDate })
        })
            .then((response) => {
                if ((response as ResponseData).code === 20000) {
                    NueMessage.success('顺延成功')
                    todos.value = todos.value.filter((t) => t.id !== todo.id)
                    todo.dueDate.endAt = endOfDay
                    useTodoStore().todos.unshift(todo)
                } else {
                    NueMessage.error('顺延失败')
                }
            })
            .catch(() => console.warn('[UseHistoryDialog/SetTodoEndAtToToday] Cancelled!'))
    }

    const setAllTodosEndAtToToday = async () => {
        const endOfDay = useMoment().endOf('d').toISOString(true)
        const todoIds = todos.value.map((t) => t.id)
        NueConfirm({
            title: '顺延所有任务至今天',
            content: '确认将所有任务顺延至今天吗？',
            confirmButtonText: '确认',
            cancelButtonText: '取消',
            onConfirm: async () =>
                await updateTodos(todoIds, {
                    dueDate: { startAt: null, endAt: endOfDay }
                })
        })
            .then((response) => {
                if ((response as ResponseData).code === 20000) {
                    NueMessage.success('所有任务顺延成功')
                    const todoStore = useTodoStore()
                    todos.value = todos.value.filter((t) => {
                        t.dueDate.endAt = endOfDay
                        todoStore.todos.unshift(t)
                    })
                } else {
                    NueMessage.error('顺延失败')
                }
            })
            .catch(() => console.warn('[UseHistoryDialog/SetTodoEndAtToToday] Cancelled!'))
    }

    watch(
        () => filterInputValue.value,
        async (newValue) => {
            if (!newValue) {
                if (Object.prototype.hasOwnProperty.call(getOptions.value, 'name')) {
                    delete getOptions.value.name
                }
            } else {
                getOptions.value.name = newValue
            }
            await getExpiredTodos()
        }
    )

    return {
        visible,
        tableLoading,
        todos,
        tags,
        columnOptions,
        filterInputValue,
        getExpiredTodos,
        getExpiredTodosWithLoading,
        setTodoEndAtToToday,
        setAllTodosEndAtToToday
    }
}
