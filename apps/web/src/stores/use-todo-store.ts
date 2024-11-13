import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getTodos, updateTodo, deleteTodo, createTodo } from '@nao-todo/apis'
import type {
    Todo,
    GetTodosOverview,
    GetTodosOptions,
    TodoColumnOptions,
    UpdateTodoOptions,
    UpdateTodoOptionsRaw,
    GetTodosResponseData,
    CreateTodoOptions,
    Project
} from '@nao-todo/types'
import { NueConfirm, NueMessage } from 'nue-ui'

export const useTodoStore = defineStore('todoStore', () => {
    const todos = ref<Todo[]>([])

    // 获取选项
    const getOptions = ref<GetTodosOptions>({
        page: 1,
        limit: 20
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
    const columnOptions = ref<TodoColumnOptions>({
        state: true,
        priority: true,
        project: true,
        endAt: true
    })

    // 修改获取选项
    const updateGetOptions = (newOptions: Partial<GetTodosOptions>) => {
        Object.assign(getOptions.value, newOptions)
    }

    // 修改显示列选项
    const updateColumnOptions = (newOptions: Partial<TodoColumnOptions>) => {
        Object.assign(columnOptions.value, newOptions)
    }

    // 添加待办
    const doCreateTodo = async (options: CreateTodoOptions) => {
        const result = await createTodo(options)
        if (result.code !== 20000) return false
        const newTodo = result.data as Todo
        console.log('[UseTodoStore] doCreateTodo:', newTodo)
        todos.value.unshift(newTodo)
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

    // 获取待办
    const doGetTodos = async () => {
        const result = await getTodos(getOptions.value)
        if (result.code !== 20000) return false
        const data = result.data as GetTodosResponseData
        todos.value = data.todos
        getOverview.value = data.payload
        return true
    }

    // 删除待办
    const doDeleteTodo = async (todoId: Todo['id']) => {
        const result = await deleteTodo(todoId)
        if (result.code !== 20000) return false
        todos.value = todos.value.filter((todo) => todo.id !== todoId)
        return true
    }

    // 删除指定待办（带确认）
    const deleteTodoWithConfirmation = async (todoId: Todo['id']) => {
        try {
            await NueConfirm({
                title: '删除待办确认',
                content: '确认删除该待办吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消'
            })
            const updateOptions = { isDeleted: true, deletedAt: Date.now() }
            const result = await doUpdateTodo(todoId, updateOptions)
            if (result) {
                NueMessage.success('待办删除成功')
                return true
            } else {
                throw new Error('delete todo failed')
            }
        } catch (error) {
            console.warn('[UseTodoStore] deleteTodoWithConfirmation:', error)
            NueMessage.error('待办删除失败')
            return false
        }
    }

    // 恢复指定待办（带确认）
    const restoreTodoWithConfirmation = async (todoId: Todo['id']) => {
        try {
            await NueConfirm({
                title: '恢复待办确认',
                content: '确认恢复该待办吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消'
            })
            const updateOptions = { isDeleted: false, deletedAt: null }
            const result = await doUpdateTodo(todoId, updateOptions)
            if (result) {
                NueMessage.success('待办恢复成功')
                return true
            } else {
                throw new Error('restore todo failed')
            }
        } catch (error) {
            console.warn('[UseTodoStore] restoreTodoWithConfirmation:', error)
            NueMessage.error('待办恢复失败')
            return false
        }
    }

    // 永久删除指定待办（带确认）
    const deleteTodoPermanentlyWithConfirmation = async (todoId: Todo['id']) => {
        try {
            await NueConfirm({
                title: '永久删除待办确认',
                content: '确认永久删除该待办吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消'
            })
            const result = await doDeleteTodo(todoId)
            if (result) {
                NueMessage.success('待办永久删除成功')
                return true
            }
        } catch (error) {
            console.warn('[UseTodoStore] deleteTodoPermanentlyWithConfirmation:', error)
            NueMessage.error('待办永久删除失败')
            return false
        }
    }

    // 根据清单偏好设置获取选项
    const setGetOptionsByPreference = (preference: Project['preference']) => {
        if (!preference) return
        if (preference.getTodosOptions) {
            getOptions.value = preference.getTodosOptions
        }
        if (preference.columns) {
            columnOptions.value = preference.columns
        }
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
        doDeleteTodo,
        doCreateTodo,
        deleteTodoWithConfirmation,
        restoreTodoWithConfirmation,
        deleteTodoPermanentlyWithConfirmation,
        setGetOptionsByPreference,
        getTodoByIdFromLocal
    }
})
