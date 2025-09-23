import type { User } from './user'
import type { Todo } from './todo'

type Event = {
    _id?: string
    id: string
    userId: User['id']
    todoId: Todo['id']
    name: string
    description: string
    isDone: boolean
    doneAt: Date | null
    sortId: number
}

type CreateEventOptionsRaw = {
    todoId: Todo['id']
    name: string
    description?: string
}

type UpdateEventOptionsRaw = {
    todoId?: Todo['id']
    name?: string
    description?: string
    isDone?: boolean
    doneAt?: Date | null
    isTopped?: boolean
}

type GetEventsOptionsRaw = {
    todoId?: Todo['id']
}

type CreateEventOptions = CreateEventOptionsRaw

type UpdateEventOptions = UpdateEventOptionsRaw

type GetEventsOptions = GetEventsOptionsRaw

type DeleteEventOptions = { id: Event['id'] }

export type {
    Event,
    CreateEventOptions,
    UpdateEventOptionsRaw,
    UpdateEventOptions,
    GetEventsOptions,
    DeleteEventOptions
}
