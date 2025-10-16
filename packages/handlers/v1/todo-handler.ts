import {
    createTodoApiV2,
    getTodosApiV2,
    updateTodoApiV2,
    deleteTodoApiV2,
    restoreTodoApiV2,
    getTodoApiV2,
    duplicateTodoApiV2
} from '@nao-todo/apis/v2'
import type {
    CreateTodoOptions,
    GetTodosOptions,
    ResponseData,
    GoLike,
    Requester,
    Todo,
    UpdateTodoOptions,
    GetTodoOptions
} from '@nao-todo/types'

const GET_TODO_SUCCESS_CODE = 40000
const CREATE_TODO_SUCCESS_CODE = 40010
const UPDATE_TODO_SUCCESS_CODE = 40020
const DELETE_TODO_SUCCESS_CODE = 40030
const RESTORE_TODO_SUCCESS_CODE = 40040
const GET_TODOS_SUCCESS_CODE = 40050
const DUPLICATE_TODO_SUCCESS_CODE = 40060

export const createTodoHandler = async (
    options: CreateTodoOptions,
    requester: Requester
): Promise<GoLike<Todo | null | undefined>> => {
    // 参数判断
    if (options.name === '') return [null, '待办任务名称不能为空']
    // 调用 API 创建待办任务
    const apiRes = await createTodoApiV2(requester, options)
    // 处理成功结果
    if (apiRes.code === CREATE_TODO_SUCCESS_CODE) {
        return [apiRes.data as Todo, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export const getTodosHandler = async (
    getOptions: GetTodosOptions,
    requester: Requester
): Promise<GoLike<{ todos: Todo[]; pagination: ResponseData['pagination'] } | null>> => {
    // 调用 API 获取待办任务列表
    const apiRes = await getTodosApiV2(requester, getOptions)
    // 处理成功结果
    if (apiRes.code === GET_TODOS_SUCCESS_CODE) {
        return [
            {
                todos: apiRes.data as Todo[],
                pagination: apiRes.pagination
            },
            null
        ]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export const getTodoHandler = async (
    getOptions: GetTodoOptions,
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 获取待办任务信息
    const apiRes = await getTodoApiV2(requester, getOptions)
    // 处理成功结果
    if (apiRes.code === GET_TODO_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export const updateTodoHandler = async (
    todoId: Todo['id'],
    updateOptions: UpdateTodoOptions,
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 更新待办任务信息
    const apiRes = await updateTodoApiV2(requester, todoId, updateOptions)
    // 处理成功结果
    if (apiRes.code === UPDATE_TODO_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export const deleteTodoHandler = async (
    todoId: Todo['id'],
    isHard: boolean,
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 删除（更新）待办任务
    const apiRes = await deleteTodoApiV2(requester, todoId, isHard || false)
    // 处理成功结果
    if (apiRes.code === DELETE_TODO_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export const restoreTodoHandler = async (
    todoId: Todo['id'],
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 删除（更新）待办任务
    const apiRes = await restoreTodoApiV2(requester, todoId)
    // 处理成功结果
    if (apiRes.code === RESTORE_TODO_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export const duplicateTodoHandler = async (
    todoId: Todo['id'],
    requester: Requester
): Promise<GoLike<Todo | null | undefined>> => {
    // 调用 API 复制待办任务
    const apiRes = await duplicateTodoApiV2(requester, todoId)
    // 处理成功结果
    if (apiRes.code === DUPLICATE_TODO_SUCCESS_CODE) {
        return [apiRes.data as Todo, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

// export const getTodoHandler = async (
//     getOptions: GetProjectOptions,
//     requester: Requester
// ): Promise<GoLike> => {
//     // 调用 API 获取待办任务信息
//     const apiRes = await (requester, getOptions)
//     // 处理成功结果
//     if (apiRes.code === GET_PROJECT_SUCCESS_CODE) {
//         return [apiRes.data, null]
//     }
//     // 处理失败结果
//     return [null, apiRes.message]
// }
