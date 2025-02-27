import type {
    Requester,
    CreateTodoOptions,
    GetTodoOptions,
    GetTodosOptions,
    GetTodosSortOptions,
    ResponseData,
    Todo,
    UpdateTodoOptions
} from '@nao-todo/types'
import { stringifyGetOptions } from '@nao-todo/utils'

export const defaultGetTodosOptions: GetTodosOptions = {
    isDeleted: false,
    page: 1,
    limit: 99
}

export const createTodoV2 = async (requester: Requester, options: CreateTodoOptions) => {
    try {
        const response = await requester(`/todo`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/create-todo-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const deleteTodoV2 = async (requester: Requester, id: Todo['id']) => {
    try {
        const response = await requester(`/todo?todoId=${id}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/delete-todo-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const updateTodoV2 = async (
    requester: Requester,
    id: Todo['id'],
    options: UpdateTodoOptions
) => {
    try {
        const response = await requester(`/todo?todoId=${id}`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/update-todo-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const updateTodosV2 = async (
    requester: Requester,
    ids: Todo['id'][],
    options: UpdateTodoOptions
) => {
    try {
        const response = await requester(`/todos`, {
            todoIds: ids,
            updateInfo: options
        })
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/update-todo-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 获取待办
export const getTodoV2 = async (requester: Requester, options: GetTodoOptions) => {
    try {
        const queryString = stringifyGetOptions(options)
        const response = await requester(`/todo?${queryString}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/get-todo-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const getTodosV2 = async (
    requester: Requester,
    options: GetTodosOptions = defaultGetTodosOptions
) => {
    try {
        const queryString = stringifyGetOptions(options, (key, value) => {
            if (key === 'sort' && value) {
                const v = value as GetTodosSortOptions
                if (!v.field) return null
                return `${key}=${(value as GetTodosSortOptions).field}:${(value as GetTodosSortOptions).order}`
            }
        })
        const response = await requester(`/todos?${queryString}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/get-todos-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const duplicateTodoV2 = async (requester: Requester, todoId: Todo['id']) => {
    try {
        const response = await requester(`/todo/duplicate?todoId=${todoId}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/duplicate-todo-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const deleteTodosV2 = async (requester: Requester, todoIds: Todo['id'][]) => {
    try {
        const response = await requester(`/todos`, { data: { todoIds } })
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/delete-todos-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}
