import type { CreateTodoOptions, GetTodosOptions, TodoColumnOptions } from '@nao-todo/types'

export interface TasksMainViewProps {
    id: string
    category: string
    icon: string
    name: string
    description: string
    preference: {
        viewType: string
        getTodosOptions: GetTodosOptions
        columns: TodoColumnOptions
    }
    createTodoOptions: CreateTodoOptions
    extra?: Record<string, any>
}
