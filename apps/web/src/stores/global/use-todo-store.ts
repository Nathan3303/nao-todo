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
    ResponseDataPagination,
    GetTodoOptions,
    GoLike
} from '@nao-todo/types'
import {
    createTodoHandler,
    getTodosHandler,
    updateTodoHandler,
    deleteTodoHandler,
    restoreTodoHandler,
    getTodoHandler,
    duplicateTodoHandler
} from '@nao-todo/handlers/v1'

const useTodoStore = defineStore('TodoStore', () => {
    // @state 待办任务列表（应该被应用于整个视图）
    const todos = ref<Todo[]>([])
    const pagination = reactive<ResponseDataPagination>({
        total: 0,
        page: 1,
        limit: 10,
        maxPage: 1,
        current: 0
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
            pagination.current = Math.min(
                res.pagination.limit,
                res.pagination.total - res.pagination.limit * (res.pagination.page - 1)
            )
        }
        // 备份获取选项
        getTodosOptionsBk.value = { ...options }
        return null
    }

    // @method 获取单个待办任务，并返回获取结果
    const toGetTodo = async (options: GetTodoOptions): Promise<GoLike> => {
        // 获取待办任务
        const [todo, err] = await getTodoHandler(options, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return [null, err]
        }
        // 处理成功结果
        return [todo, null]
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
    const createTodo = async (
        createOptions: CreateTodoOptions
    ): Promise<GoLike<Todo['id'] | null | undefined>> => {
        // 参数判断
        if (!createOptions.name) return [null, '待办任务名称不能为空']
        if (!createOptions.state) return [null, '待办任务状态不能为空']
        if (!createOptions.priority) return [null, '待办任务优先级不能为空']
        if (!createOptions.endAt) return [null, '待办任务截止时间不能为空']
        if (!createOptions.projectId) return [null, '待办任务所属清单 ID 不能为空']
        // 创建待办任务
        const [todo, err] = await createTodoHandler(createOptions, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return [null, err]
        }
        // 处理成功结果
        if (todo && todos.value.length <= pagination.limit) {
            // 待办任务列表未满，直接添加
            todos.value.push(todo)
            // 待办任务列表未满，更新分页信息
            pagination.current++
            pagination.total++
            pagination.maxPage = Math.ceil(pagination.total / pagination.limit)
            // 待办任务列表未满，返回待办任务 ID
            return [todo.id, null]
        }
        return [null, null]
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
            todos.value[todoIdx] = {
                ...todos.value[todoIdx],
                ...options,
                updatedAt: new Date().toISOString()
            }
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
            // @ts-expect-error 忽略对象字面量只能指定已知属性的错误
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

    // @method 复制待办任务
    const duplicateTodo = async (
        todoId: Todo['id']
    ): Promise<GoLike<Todo['id'] | null | undefined>> => {
        // 参数判断
        if (!todoId) return [null, '待办任务ID不能为空']
        // 复制待办任务
        const [todo, err] = await duplicateTodoHandler(todoId, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return [null, err]
        }
        // 处理成功结果
        if (todo && todos.value.length <= pagination.limit) {
            // 待办任务列表未满，直接添加
            todos.value.push(todo)
            // 待办任务列表未满，更新分页信息
            pagination.current++
            pagination.total++
            pagination.maxPage = Math.ceil(pagination.total / pagination.limit)
            // 待办任务列表未满，返回待办任务 ID
            return [todo.id, null]
        }
        return [null, '待办任务复制失败']
    }

    // @method 复制待办任务（带确认）
    const duplicateTodoWithComfirm = async (
        todoId: Todo['id']
    ): Promise<GoLike<Todo['id'] | null | undefined>> => {
        return (await NueConfirm({
            title: '复制待办任务',
            content: '确定要复制此待办任务吗？操作将会复制除待办任务评论以外的信息',
            confirmButtonText: '复制',
            cancelButtonText: '取消',
            onConfirm: async () => {
                const [newTodoId, err] = await duplicateTodo(todoId)
                if (err) {
                    NueMessage.error(unwrapError(err))
                    return [null, err]
                }
                NueMessage.success('复制待办任务成功')
                return [newTodoId, null]
            }
        })) as GoLike<Todo['id'] | null | undefined>
    }

    // @method 清除必要的状态
    const __resetStates = () => {
        todos.value = [] as Todo[]
    }

    return {
        todos,
        pagination,
        getTodos,
        toGetTodo,
        createTodo,
        updateTodo,
        deleteTodo,
        restoreTodo,
        deleteTodoPermanently,
        deleteTodoWithConfirm,
        restoreTodoWithConfirm,
        deleteTodoPermanentlyWithConfirm,
        regetTodos,
        duplicateTodo,
        duplicateTodoWithComfirm,
        __resetStates
    }
})

export default useTodoStore
