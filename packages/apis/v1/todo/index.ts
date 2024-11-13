import $axios from '@nao-todo/utils/axios'
import { stringifyGetOptions } from '@nao-todo/utils'
import { defaultGetTodosOptions } from './constants'
import type {
    Todo,
    GetTodoOptions,
    GetTodosOptions,
    UpdateTodoOptions,
    CreateTodoOptions,
    ResponseData,
    GetTodosSortOptions
} from '@nao-todo/types'

// 添加待办
export const createTodo = async (options: CreateTodoOptions) => {
    try {
        const response = await $axios.post(`/todo`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/todo] createTodo:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 删除待办
export const deleteTodo = async (id: Todo['id']) => {
    try {
        const response = await $axios.delete(`/todo?todoId=${id}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/todo] deleteTodo:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 更新待办
export const updateTodo = async (id: Todo['id'], options: UpdateTodoOptions) => {
    try {
        const response = await $axios.put(`/todo?todoId=${id}`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/todo] updateTodo:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 获取待办
export const getTodo = async (options: GetTodoOptions) => {
    try {
        const queryString = stringifyGetOptions(options)
        const response = await $axios.get(`/todo?${queryString}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/todo] getTodo:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 获取待办（s）
export const getTodos = async (options: GetTodosOptions = defaultGetTodosOptions) => {
    try {
        const queryString = stringifyGetOptions(options, (key, value) => {
            if (key === 'sort' && value) {
                return `${key}=${(value as GetTodosSortOptions).field}:${(value as GetTodosSortOptions).order}`
            }
        })
        const response = await $axios.get(`/todos?${queryString}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/todo] getTodos:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}
