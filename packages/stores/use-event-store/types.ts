import type { Todo } from '../use-todo-store'
import type { User } from '../use-user-store'

export type Event = {
    id: string
    userId: User['id']
    todoId: Todo['id']
    title: string
    isDone: boolean
    isTopped: boolean
    createdAt: string
    updatedAt: string
}

export type EventFilterOptions = {
    id?: Event['id']
    todoId?: Event['todoId']
    title?: Event['title']
    isDone?: Event['isDone']
    isTopped?: Event['isTopped']
    page?: number
    limit?: number
}
