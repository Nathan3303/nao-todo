import type {
    Requester,
    CreateTodoOptions,
    GetTodosOptions,
    GetTodosSortOptions,
    ResponseData,
    Todo,
    UpdateTodoOptions
} from '@nao-todo/types'
import { stringifyGetOptions } from '@nao-todo/utils'

export const createTodoApiV2 = async (requester: Requester, options: CreateTodoOptions) => {
    try {
        const response = await requester.post(`/todo/`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/create-todo-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const getTodosApiV2 = async (requester: Requester, options: GetTodosOptions) => {
    try {
        let queryString = stringifyGetOptions(options, (key, value) => {
            if (key === 'sort' && value) {
                const v = value as GetTodosSortOptions
                if (!v.field) return null
                return `${key}=${(value as GetTodosSortOptions).field}:${(value as GetTodosSortOptions).order}`
            }
        })
        queryString = queryString ? `?${queryString}` : ''
        const response = await requester.get(`/todos/${queryString}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/get-todos-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const updateTodoApiV2 = async (
    requester: Requester,
    id: Todo['id'],
    options: UpdateTodoOptions
) => {
    try {
        const response = await requester.put(`/todo/${id}`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/update-todo-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const deleteTodoApiV2 = async (requester: Requester, id: Todo['id'], isHard: boolean) => {
    try {
        const response = await requester.delete(`/todo/${id}?hard=${isHard}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/delete-todo-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const restoreTodoApiV2 = async (requester: Requester, id: Todo['id']) => {
    try {
        const response = await requester.put(`/todo/restore/${id}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/restore-todo-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

// export const updateTodosV2 = async (
//     requester: Requester,
//     ids: Todo['id'][],
//     options: UpdateTodoOptions
// ) => {
//     try {
//         const response = await requester.put(`/todos`, {
//             todoIds: ids,
//             updateInfo: options
//         })
//         return response.data as ResponseData
//     } catch (error) {
//         console.error('[@nao-todo/apis/update-todo-v2]', error)
//         return { code: 500, message: '服务器错误' } as ResponseData
//     }
// }

// 获取待办
// export const getTodoV2 = async (requester: Requester, options: GetTodoOptions) => {
//     try {
//         const queryString = stringifyGetOptions(options)
//         const response = await requester.get(`/todo?${queryString}`)
//         return response.data as ResponseData
//     } catch (error) {
//         console.error('[@nao-todo/apis/get-todo-v2]', error)
//         return { code: 500, message: '服务器错误' } as ResponseData
//     }
// }

// export const duplicateTodoV2 = async (requester: Requester, todoId: Todo['id']) => {
//     try {
//         const response = await requester.get`(`/todo/duplicate?todoId=${todoId}`)
//         return response.data as ResponseData
//     } catch (error) {
//         console.error('[@nao-todo/apis/duplicate-todo-v2]', error)
//         return { code: 500, message: '服务器错误' } as ResponseData
//     }
// }

// export const deleteTodosV2 = async (requester: Requester, todoIds: Todo['id'][]) => {
//     try {
//         const response = await requester.delete(`/todos`, { data: { todoIds } })
//         return response.data as ResponseData
//     } catch (error) {
//         console.error('[@nao-todo/apis/delete-todos-v2]', error)
//         return { code: 500, message: '服务器错误' } as ResponseData
//     }
// }
