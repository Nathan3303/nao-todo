import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { unwrapError } from '@nao-todo/utils'
import { requester } from './requester'
import { NueConfirm, NueMessage } from 'nue-ui'
import type {
    CreateTodoOptions,
    Err,
    GetTodosOptions,
    Todo,
    UpdateTodoOptions,
    ResponseDataPagination
} from '@nao-todo/types'
import {
    createTodoHandler,
    getTodosHandler,
    updateTodoHandler,
    deleteTodoHandler,
    restoreTodoHandler
} from '@nao-todo/handlers/v1'

const useTodoStore = defineStore('TodoStore', () => {
    // @state 待办任务列表（应该被应用于整个视图）
    const todos = ref<Todo[]>([])
    const pagination = reactive<ResponseDataPagination>({
        total: 0,
        page: 1,
        limit: 10,
        maxPage: 1
    })
    const getTodosOptionsBk = ref<GetTodosOptions>({})

    // @method 进一步筛选待办任务列表
    const getTodos = async (options: GetTodosOptions): Promise<Err> => {
        // 获取待办任务列表
        const [res, err] = await getTodosHandler(options, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        if (res && res.pagination) {
            // todos.value.length = 0
            todos.value = res.todos || []
            pagination.limit = res.pagination.limit
            pagination.total = res.pagination.total
            pagination.page = res.pagination.page
            pagination.maxPage = res.pagination.maxPage
        }
        // 备份获取选项
        getTodosOptionsBk.value = { ...options }
        return null
    }

    // @method 重新获取待办任务列表
    const regetTodos = async (): Promise<Err> => {
        // console.log(1);
        // 调用 getTodos
        const err = await getTodos(getTodosOptionsBk.value)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        return null
    }

    // @method 创建待办任务
    const createTodo = async (createOptions: CreateTodoOptions): Promise<Err> => {
        // 参数判断
        if (!createOptions.name) return '待办任务名称不能为空'
        if (!createOptions.state) return '待办任务状态不能为空'
        if (!createOptions.priority) return '待办任务优先级不能为空'
        if (!createOptions.endAt) return '待办任务截止时间不能为空'
        if (!createOptions.projectId) return '待办任务所属清单 ID 不能为空'
        // 创建待办任务
        const [res, err] = await createTodoHandler(createOptions, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        if (todos.value.length < pagination.limit) {
            todos.value.push(res)
            // console.log('todos', todos.value)
        }
        return null
    }

    // @method 更新待办任务
    const updateTodo = async (todoId: Todo['id'], options: UpdateTodoOptions): Promise<Err> => {
        // 参数判断
        if (options.name === '') return '待办任务名称不能为空'
        if (options.endAt === '') return '待办任务截止时间不能为空'
        if (options.startAt === '') return '待办任务开始时间不能为空'
        // 更新待办任务
        const [, err] = await updateTodoHandler(todoId, options, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        const todoIdx = todos.value.findIndex((todo) => todo.id === todoId)
        if (todoIdx >= 0) {
            todos.value[todoIdx] = { ...todos.value[todoIdx], ...options }
        }
        return null
    }

    // @method 删除待办任务
    const deleteTodo = async (todoId: Todo['id']): Promise<Err> => {
        // 参数判断
        if (!todoId) return '待办任务ID不能为空'
        // 删除待办任务
        const [, err] = await deleteTodoHandler(todoId, false, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        todos.value.forEach((todo) => {
            if (todo.id === todoId) {
                todo.isDeleted = true
            }
        })
        return null
    }

    // @method 恢复待办任务
    const restoreTodo = async (todoId: Todo['id']): Promise<Err> => {
        // 参数判断
        if (!todoId) return '待办任务ID不能为空'
        // 删除待办任务
        const [, err] = await restoreTodoHandler(todoId, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        todos.value.forEach((todo) => {
            if (todo.id === todoId) {
                todo.isDeleted = false
            }
        })
        return null
    }

    // @method 永久删除待办任务
    const deleteTodoPermanently = async (todoId: Todo['id']): Promise<Err> => {
        // 参数判断
        if (!todoId) return '待办任务ID不能为空'
        // 删除待办任务
        const [, err] = await deleteTodoHandler(todoId, true, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        todos.value = todos.value.filter((todo) => todo.id !== todoId)
        return null
    }

    // @method 删除待办任务（带确认）
    const deleteTodoWithConfirm = async (todoId: Todo['id']): Promise<Err> => {
        return (await NueConfirm({
            title: '删除待办任务',
            content: '确定要删除此待办任务吗？',
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            onConfirm: async () => {
                const err = await deleteTodo(todoId)
                if (err) {
                    NueMessage.error(unwrapError(err))
                    return err
                }
                NueMessage.success('删除成功')
                return 'ok'
            }
        })) as Err
    }

    // @method 恢复待办任务（带确认）
    const restoreTodoWithConfirm = async (todoId: Todo['id']): Promise<Err> => {
        return (await NueConfirm({
            title: '恢复待办任务',
            content: '要恢复此待办任务吗？',
            confirmButtonText: '恢复',
            cancelButtonText: '取消',
            onConfirm: async () => {
                const err = await restoreTodo(todoId)
                if (err) {
                    NueMessage.error(unwrapError(err))
                    return err
                }
                NueMessage.success('恢复成功')
                return 'ok'
            }
        })) as Err
    }

    // @method 永久删除待办任务（带确认）
    const deleteTodoPermanentlyWithConfirm = async (todoId: Todo['id']): Promise<Err> => {
        return (await NueConfirm({
            title: '永久删除待办任务',
            content: '确定要永久删除此待办任务吗？',
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            theme: 'danger',
            onConfirm: async () => {
                const err = await deleteTodoPermanently(todoId)
                if (err) {
                    NueMessage.error(unwrapError(err))
                    return err
                }
                NueMessage.success('永久删除成功')
                return 'ok'
            }
        })) as Err
    }

    return {
        todos,
        pagination,
        getTodos,
        createTodo,
        updateTodo,
        deleteTodo,
        restoreTodo,
        deleteTodoPermanently,
        deleteTodoWithConfirm,
        restoreTodoWithConfirm,
        deleteTodoPermanentlyWithConfirm,
        regetTodos
    }
})

export default useTodoStore
