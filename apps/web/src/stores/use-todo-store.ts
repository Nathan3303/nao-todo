import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getTodos } from '@nao-todo/apis'
import type { GetTodosOptions, Todo } from '@nao-todo/types'

export const useTodoStore = defineStore('todoStore', () => {
    const todos = ref<Todo[]>([])

    // 获取选项
    const getOptions = ref<GetTodosOptions>({
        page: 1,
        limit: 20,
        sort: { field: 'createdAt', order: 'desc' }
    })

    // 获取待办
    const doGetTodos = async () => {
        const result = await getTodos(getOptions.value)
        if (result.code !== 20000) return false
        todos.value = result.data as Todo[]
        return true
    }

    return {
        todos,
        doGetTodos
    }
})
