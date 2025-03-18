import axios from 'axios'
import $axios from '@nao-todo/utils/axios'
import { stringifyGetOptions } from '@nao-todo/utils'
import { defaultGetTodosOptions } from './constants'
import type {
    CreateTodoOptions,
    GetTodoOptions,
    GetTodosOptions,
    GetTodosSortOptions,
    ResponseData,
    Todo,
    UpdateTodoOptions
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

// 更新待办(s)
export const updateTodos = async (ids: Todo['id'][], options: UpdateTodoOptions) => {
    try {
        const response = await $axios.put(`/todos`, {
            todoIds: ids,
            updateInfo: options
        })
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/todo] updateTodos:', error)
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
export const getTodos = async (
    options: GetTodosOptions = defaultGetTodosOptions,
    abortSignal?: AbortSignal
) => {
    try {
        const queryString = stringifyGetOptions(options, (key, value) => {
            if (key === 'sort' && value) {
                const v = value as GetTodosSortOptions
                if (!v.field) return null
                return `${key}=${(value as GetTodosSortOptions).field}:${(value as GetTodosSortOptions).order}`
            } else if (key === 'name') {
                return value === null ? null : `${key}=${value}`
            }
        })
        const requestConfig = abortSignal ? { signal: abortSignal } : {}
        const response = await $axios.get(`/todos?${queryString}`, requestConfig)
        return response.data as ResponseData
    } catch (error) {
        if (axios.isCancel(error)) {
            console.warn('[@nao-todo/apis/todo] getTodos: 请求已取消')
            return { code: 50002, message: '请求已取消' } as ResponseData
        }
        console.error('[@nao-todo/apis/todo] getTodos:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 复制待办
export const duplicateTodo = async (todoId: Todo['id']) => {
    try {
        const response = await $axios.get(`/todo/duplicate?todoId=${todoId}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/todo] duplicateTodo:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 永久删除待办（s）
export const deleteTodos = async (todoIds: Todo['id'][]) => {
    try {
        const response = await $axios.delete(`/todos`, { data: { todoIds } })
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/todo] deleteTodos:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}
