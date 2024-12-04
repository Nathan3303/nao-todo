import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import {
    createTodo,
    deleteTodo,
    duplicateTodo,
    getTodos,
    updateTodo,
    updateTodos
} from '@nao-todo/apis'
import { NueConfirm, NueMessage } from 'nue-ui'
import { useMoment } from '@nao-todo/utils'
import type {
    CreateTodoOptions,
    GetTodosOptions,
    GetTodosOverview,
    GetTodosResponseData,
    Project,
    Todo,
    TodoColumnOptions,
    UpdateTodoOptions,
    UpdateTodoOptionsRaw
} from '@nao-todo/types'

export const useTodoStore = defineStore('todoStore', () => {
    const todos = ref<Todo[]>([])

    // 获取选项
    const getOptions = shallowRef<GetTodosOptions>({
        page: 1,
        limit: 20
    })

    // 获取结果总览
    const getOverview = shallowRef<GetTodosOverview>({
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
    const columnOptions = shallowRef<TodoColumnOptions>({
        state: true,
        priority: true,
        project: true,
        endAt: true,
        description: true,
        createdAt: false,
        updatedAt: false
    })

    // 修改获取选项
    const updateGetOptions = (newOptions: Partial<GetTodosOptions>) => {
        getOptions.value = newOptions
    }

    // 合并获取选项
    const mergeGetOptions = (newOptions: GetTodosOptions) => {
        Object.assign(getOptions.value, newOptions)
    }

    // 修改显示列选项
    const updateColumnOptions = (newOptions: Partial<TodoColumnOptions>) => {
        columnOptions.value = newOptions
    }

    // 添加待办
    const doCreateTodo = async (options: CreateTodoOptions) => {
        const result = await createTodo(options)
        if (result.code !== 20000) return false
        const newTodo = result.data as Todo
        // console.log('[UseTodoStore] doCreateTodo:', newTodo)
        todos.value.unshift(newTodo)
        return newTodo
    }

    // 更新本地待办
    const updateLocalTodo = (todoId: Todo['id'], options: UpdateTodoOptions) => {
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

    // 删除本地代办
    const deleteLocalTodo = (todoId: Todo['id']) => {
        const index = todos.value.findIndex((todo) => todo.id === todoId)
        if (index === -1) return false
        todos.value.splice(index, 1)
        return true
    }

    // 更新待办
    const doUpdateTodo = async (todoId: Todo['id'], options: UpdateTodoOptions) => {
        const result = await updateTodo(todoId, options)
        if (result.code !== 20000) return false
        return updateLocalTodo(todoId, options)
    }

    // 更新待办（s）
    const doUpdateTodos = async (todoIds: Todo['id'][], options: UpdateTodoOptions) => {
        const result = await updateTodos(todoIds, options)
        if (result.code !== 20000) return false
        todoIds.forEach((todoId) => {
            updateLocalTodo(todoId, options)
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

    // 复制待办
    const doDuplicateTodo = async (todoId: Todo['id']) => {
        const result = await duplicateTodo(todoId)
        if (result.code !== 20000) return false
        const newTodo = result.data as Todo
        todos.value.unshift(newTodo)
        return newTodo
    }

    // 删除指定待办（带确认）
    const deleteTodoWithConfirmation = async (todoId: Todo['id']) => {
        try {
            const result = await NueConfirm({
                title: '删除待办确认',
                content: '确认删除该待办吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                onConfirm: async () =>
                    await doUpdateTodo(todoId, {
                        isDeleted: true,
                        deletedAt: useMoment().toISOString()
                    })
            })
            if (result) {
                NueMessage.success('待办删除成功')
                deleteLocalTodo(todoId)
                return true
            } else {
                NueMessage.error('待办删除失败')
            }
        } catch (error) {
            console.warn('[UseTodoStore] deleteTodoWithConfirmation:', error)
        }
        return false
    }

    // 恢复指定待办（带确认）
    const restoreTodoWithConfirmation = async (todoId: Todo['id']) => {
        try {
            const result = await NueConfirm({
                title: '恢复待办确认',
                content: '确认恢复该待办吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                onConfirm: async () =>
                    await doUpdateTodo(todoId, { isDeleted: false, deletedAt: null })
            })
            if (result) {
                NueMessage.success('待办恢复成功')
                return deleteLocalTodo(todoId)
            } else {
                NueMessage.error('待办恢复失败')
            }
        } catch (error) {
            console.warn('[UseTodoStore] restoreTodoWithConfirmation:', error)
        }
        return false
    }

    // 删除指定待办(s)（带确认）
    const deleteTodosWithConfirmation = async (todoIds: Todo['id'][]) => {
        try {
            const result = await NueConfirm({
                title: '删除多个待办确认',
                content: '确认删除这些待办吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                onConfirm: async () =>
                    await doUpdateTodos(todoIds, {
                        isDeleted: true,
                        deletedAt: useMoment().toISOString()
                    })
            })
            if (result) {
                return NueMessage.success('更新成功')
            } else {
                NueMessage.error('更新失败')
            }
        } catch (error) {
            console.warn('[UseTodoStore] deleteTodosWithConfirmation:', error)
        }
        return false
    }

    // 恢复指定待办(s)（带确认）
    const restoreTodosWithConfirmation = async (todoIds: Todo['id'][]) => {
        try {
            const result = await NueConfirm({
                title: '恢复多个待办确认',
                content: '确认恢复这些待办吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                onConfirm: async () =>
                    await doUpdateTodos(todoIds, { isDeleted: false, deletedAt: null })
            })
            if (result) {
                NueMessage.success('更新成功')
                return true
            } else {
                NueMessage.error('更新失败')
            }
        } catch (error) {
            console.warn('[UseTodoStore] restoreTodosWithConfirmation:', error)
        }
        return false
    }

    // 永久删除指定待办（带确认）
    const deleteTodoPermanentlyWithConfirmation = async (todoId: Todo['id']) => {
        try {
            const result = await NueConfirm({
                title: '永久删除待办确认',
                content: '确认永久删除该待办吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                onConfirm: async () => await doDeleteTodo(todoId)
            })
            if (result) {
                NueMessage.success('待办永久删除成功')
                return true
            } else {
                NueMessage.error('待办永久删除失败')
            }
        } catch (error) {
            console.warn('[UseTodoStore] deleteTodoPermanentlyWithConfirmation:', error)
        }
        return false
    }

    // 复制任务（带确认）
    const duplicateTodoWithConfirmation = async (todoId: Todo['id']) => {
        try {
            const result = await NueConfirm({
                title: '复制待办确认',
                content: '确认复制该待办吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                onConfirm: async () => await doDuplicateTodo(todoId)
            })
            if (result) {
                NueMessage.success('待办复制成功')
                return result
            } else {
                NueMessage.error('待办复制失败')
            }
        } catch (error) {
            console.warn('[UseTodoStore] duplicateTodoWithConfirmation:', error)
        }
        return false
    }

    // 根据清单偏好设置获取选项
    const setGetOptionsByPreference = (preference: Project['preference']) => {
        if (!preference) return
        // console.log('[UseTodoStore] setGetOptionsByPreference:', preference)
        updateGetOptions(preference.getTodosOptions)
        updateColumnOptions(preference.columns)
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
        mergeGetOptions,
        updateColumnOptions,
        doGetTodos,
        doUpdateTodo,
        doUpdateTodos,
        doDeleteTodo,
        doCreateTodo,
        doDuplicateTodo,
        deleteTodoWithConfirmation,
        restoreTodoWithConfirmation,
        deleteTodosWithConfirmation,
        restoreTodosWithConfirmation,
        deleteTodoPermanentlyWithConfirmation,
        duplicateTodoWithConfirmation,
        setGetOptionsByPreference,
        getTodoByIdFromLocal
    }
})
