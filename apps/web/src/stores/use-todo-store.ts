import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getTodos, updateTodo } from '@nao-todo/apis'
import type {
    Todo,
    GetTodosOverview,
    GetTodosOptions,
    TodoColumnOptions,
    UpdateTodoOptions,
    UpdateTodoOptionsRaw,
    GetTodosResponseData
} from '@nao-todo/types'

export const useTodoStore = defineStore('todoStore', () => {
    const todos = ref<Todo[]>([])

    // 获取选项
    const getOptions = ref<GetTodosOptions>({
        page: 1,
        limit: 20,
        state: '',
        priority: '',
        sort: { field: 'createdAt', order: 'desc' }
    })

    // 获取结果总览
    const getOverview = ref<GetTodosOverview>({
        countInfo: {
            byPriority: {},
            byState: {},
            total: 0,
            length: 0,
            count: 0
        },
        pageInfo: { page: 1, totalPages: 1 }
    })

    // 显示列选项
    const columnOptions = ref<TodoColumnOptions>({})

    // 修改获取选项
    const updateGetOptions = (newOptions: Partial<GetTodosOptions>) => {
        Object.assign(getOptions.value, newOptions)
    }

    // 修改显示列选项
    const updateColumnOptions = (newOptions: Partial<TodoColumnOptions>) => {
        Object.assign(columnOptions.value, newOptions)
    }

    // 获取待办
    const doGetTodos = async () => {
        const result = await getTodos(getOptions.value)
        if (result.code !== 20000) return false
        const data = result.data as GetTodosResponseData
        todos.value = data.todos
        getOverview.value = data.payload
        return true
    }

    // 更新待办
    const doUpdateTodo = async (todoId: Todo['id'], options: UpdateTodoOptions) => {
        const result = await updateTodo(todoId, options)
        if (result.code !== 20000) return false
        const index = todos.value.findIndex((todo) => todo.id === todoId)
        if (index === -1) return false
        Object.keys(todos.value[index]).forEach((key) => {
            if (key in options) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                todos.value[index][key] = options[key as keyof UpdateTodoOptionsRaw]
            }
        })
        return true
    }

    // 根据清单偏好设置获取选项
    const setGetOptionsByPreference = (preference: GetTodosOptions) => {
        getOptions.value = preference
    }

    // 获取本地待办
    const getTodoByIdFromLocal = (id: Todo['id']) => {
        return todos.value.find((todo) => todo.id === id)
    }

    return {
        todos,
        getOptions,
        getOverview,
        columnOptions,
        updateGetOptions,
        updateColumnOptions,
        doGetTodos,
        doUpdateTodo,
        setGetOptionsByPreference,
        getTodoByIdFromLocal
    }
})
