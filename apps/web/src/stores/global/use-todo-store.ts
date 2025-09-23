import { defineStore } from 'pinia'
import { ref } from 'vue'
import { unwrapError } from '@nao-todo/utils'
import { requester } from './requester'
import type {
    CreateTodoOptions,
    Err,
    GetTodosOptions,
    Todo,
    ResponseData,
    UpdateTodoOptions
} from '@nao-todo/types'
import { createTodoHandler, getTodosHandler, updateTodoHandler } from '@nao-todo/handlers/v1'

const useTodoStore = defineStore('TodoStore', () => {
    // @state 待办任务列表（应该被应用于整个视图）
    const todos = ref<Todo[]>([])
    const pagination = ref<ResponseData['pagination']>({ total: 0, page: 1, limit: 10, maxPage: 1 })

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
        if (res) {
            todos.value = res.todos
            pagination.value = res.pagination
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
        todos.value.push(res)
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
    // const deleteProject = async (projectId: Project['id']): Promise<Err> => {
    //     // 参数判断
    //     if (!projectId) return '待办任务ID不能为空'
    //     // 删除待办任务
    //     const [, err] = await deleteProjectHandler(projectId)
    //     // 处理失败结果
    //     if (err) {
    //         console.error(unwrapError(err))
    //         return err
    //     }
    //     // 处理成功结果
    //     // projects.value = projects.value.filter((project) => project.id !== projectId)
    //     projects.value.forEach((project) => {
    //         if (project.id === projectId) {
    //             project.isDeleted = true
    //         }
    //     })
    //     return null
    // }

    // @method 恢复待办任务
    // const restoreProject = async (projectId: Project['id']): Promise<Err> => {
    //     // 参数判断
    //     if (!projectId) return '待办任务ID不能为空'
    //     // 删除待办任务
    //     const [, err] = await restoreProjectHandler(projectId)
    //     // 处理失败结果
    //     if (err) {
    //         console.error(unwrapError(err))
    //         return err
    //     }
    //     // 处理成功结果
    //     // projects.value = projects.value.filter((project) => project.id !== projectId)
    //     projects.value.forEach((project) => {
    //         if (project.id === projectId) {
    //             project.isDeleted = false
    //         }
    //     })
    //     return null
    // }

    // @method 永久删除待办任务
    // const deleteProjectPermanently = async (projectId: Project['id']): Promise<Err> => {
    //     // 参数判断
    //     if (!projectId) return '待办任务ID不能为空'
    //     // 删除待办任务
    //     const [, err] = await deleteProjectHandler(projectId, true)
    //     // 处理失败结果
    //     if (err) {
    //         console.error(unwrapError(err))
    //         return err
    //     }
    //     // 处理成功结果
    //     projects.value = projects.value.filter((project) => project.id !== projectId)
    //     return null
    // }

    // @method 删除待办任务（带确认）
    // const deleteProjectWithConfirm = async (projectId: Project['id']): Promise<Err> => {
    //     return (await NueConfirm({
    //         title: '删除待办任务',
    //         content: '确定要删除此待办任务吗？',
    //         confirmButtonText: '删除',
    //         cancelButtonText: '取消',
    //         onConfirm: async () => {
    //             const err = await deleteProject(projectId)
    //             if (err) {
    //                 NueMessage.error(unwrapError(err))
    //                 return err
    //             }
    //             NueMessage.success('删除成功')
    //             return 'ok'
    //         }
    //     })) as Err
    // }

    // @method 恢复待办任务（带确认）
    // const restoreProjectWithConfirm = async (projectId: Project['id']): Promise<Err> => {
    //     return (await NueConfirm({
    //         title: '恢复待办任务',
    //         content: '要恢复此待办任务吗？',
    //         confirmButtonText: '恢复',
    //         cancelButtonText: '取消',
    //         onConfirm: async () => {
    //             const err = await restoreProject(projectId)
    //             if (err) {
    //                 NueMessage.error(unwrapError(err))
    //                 return err
    //             }
    //             NueMessage.success('恢复成功')
    //             return 'ok'
    //         }
    //     })) as Err
    // }

    // @method 永久删除待办任务（带确认）
    // const deleteProjectPermanentlyWithConfirm = async (projectId: Project['id']): Promise<Err> => {
    //     return (await NueConfirm({
    //         title: '永久删除待办任务',
    //         content: '确定要永久删除此待办任务吗？永久删除待办任务会删除归属于该待办任务的所有任务',
    //         confirmButtonText: '删除',
    //         cancelButtonText: '取消',
    //         theme: 'danger',
    //         onConfirm: async () => {
    //             const err = await deleteProjectPermanently(projectId)
    //             if (err) {
    //                 NueMessage.error(unwrapError(err))
    //                 return err
    //             }
    //             NueMessage.success('永久删除成功')
    //             return 'ok'
    //         }
    //     })) as Err
    // }

    return {
        todos,
        pagination,
        getTodos,
        createTodo,
        updateTodo
        // deleteTodo,
        // restoreProject,
        // deleteProjectPermanently,
        // deleteProjectWithConfirm,
        // restoreProjectWithConfirm,
        // deleteProjectPermanentlyWithConfirm
    }
})

export default useTodoStore
