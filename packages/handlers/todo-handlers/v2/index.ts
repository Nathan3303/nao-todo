// 导入useTodoStore函数和FetchTodosOptions、Todo类型
import { useTodoStore } from '@nao-todo/stores/use-todo-store/v2/use-todo-store'
import type { FetchTodosOptions, Todo } from '@nao-todo/stores/use-todo-store/v2/types'

// 使用useTodoStore函数获取todoStore
const todoStore = useTodoStore()

// 根据projectId获取待办事项
export const getTodosByProjectId = async (projectId: Todo['projectId']) => {
    const options = { projectId } as FetchTodosOptions
    const response = await todoStore.fetchTodos(options)
    return response.code === 20000
}

// 根据tagId获取待办事项
export const getTodosByTagId = async (tagId: string) => {}

// 根据userId获取待办事项（收集箱)
export const getTodosByUserId = async (userId: Todo['userId']) => {}

// 根据自定义选项获取待办事项
export const getTodosByCustomOptions = async (options: FetchTodosOptions) => {}
