import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type {
    GetTodosOptions,
    GetTodosOverview,
    GetTodosResponseData,
    GetTodosSortOptions,
    Project,
    Todo,
    TodoColumnOptions
} from '@nao-todo/types'
import { stringifyGetOptions } from '@nao-todo/utils'
import { ApiBaseURL } from '@/constants'
import { doRequest } from './do-request'
import { todoStoreDefaults } from '@/pages/tasks/constants'

export const useTodoStore = defineStore('TodoStore', () => {
    const todos = ref<Todo[]>([])
    const getOptions = shallowRef<GetTodosOptions>(todoStoreDefaults.getOptions)
    const getOverview = shallowRef<GetTodosOverview>(todoStoreDefaults.getOverview)
    const columnOptions = shallowRef<TodoColumnOptions>(todoStoreDefaults.columnOptions)

    // 获取待办
    const getTodos = async () => {
        const queryString = stringifyGetOptions(getOptions.value, (key, value) => {
            if (key === 'sort' && value) {
                const v = value as GetTodosSortOptions
                if (!v.field) return null
                return `${key}=${(value as GetTodosSortOptions).field}:${(value as GetTodosSortOptions).order}`
            }
        })
        const response = await doRequest({
            method: 'GET',
            url: ApiBaseURL + `/todos?${queryString}`
        })
        if (response.code !== 20000) return false
        const data = response.data as GetTodosResponseData
        todos.value = data.todos
        getOverview.value = data.payload
        return true
    }

    // 根据清单偏好设置获取选项
    const setGetOptionsByPreference = (preference: Project['preference']) => {
        if (!preference) return
        getOptions.value = preference.getTodosOptions
        columnOptions.value = preference.columns
    }

    // 获取本地待办
    const getTodoByIdFromLocal = (id: Todo['id']) => {
        return todos.value.find((todo) => todo.id === id)
    }

    return {
        todos,
        getOptions,
        getOverview,
        columnOptions,
        getTodos,
        setGetOptionsByPreference,
        getTodoByIdFromLocal
    }
})
