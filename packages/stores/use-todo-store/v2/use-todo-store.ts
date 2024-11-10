import { ref } from 'vue'
import { defineStore } from 'pinia'
import $axios from '@nao-todo/utils/axios'
import type { FetchTodosOptions, ResponseData, Todo } from './types'
import { defaultFetchTodosOptions } from './constants'

export const useTodoStore = defineStore('todoStore', () => {
    const todos = ref<Todo[]>([])

    const fetchTodos = async (options: FetchTodosOptions = defaultFetchTodosOptions) => {
        try {
            const queryPairs: string[] = []
            Object.keys(options).forEach((key) => {
                const value = options[key as keyof FetchTodosOptions]
                queryPairs.push(`${key}=${value}`)
            })
            const queryString = queryPairs.join('&')
            const response = await $axios.get(`/todos?${queryString}`)
            const responseData = response.data as ResponseData
            if (responseData.code === 20000) {
                console.log(responseData.data)
                todos.value = responseData.data as Todo[]
            }
            return responseData
        } catch (e) {
            console.log('[UseTodoStore] fetchTodo error: ', e)
            return { code: 50001, message: '服务器错误' } as ResponseData
        }
    }

    return {
        todos,
        fetchTodos
    }
})
