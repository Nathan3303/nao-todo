import type {
    CreateTodoOptions,
    GetTodosOptions,
    Project,
    TodoColumnOptions
} from '@nao-todo/types'

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
    readyState: number
}

export type TasksMainViewWatch = [string, string, Project['preference'], number]
