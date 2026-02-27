import type { CreateEvent, Event, UpdateEvent } from '@nao-todo/types'
import type { EventEntity } from '@nao-todo/domain/event'

export const createEvent2EventEntity = (createEvent: CreateEvent): EventEntity => {
    return {
        id: '',
        taskId: createEvent.taskId,
        name: createEvent.name,
        description: createEvent.description || '',
        isDone: false,
        sortId: 0
    }
}

export const eventEntity2ViewObject = (entity: EventEntity): Event => {
    const vo = {} as Event
    vo.id = entity.id
    vo.taskId = entity.taskId
    vo.name = entity.name
    vo.description = entity.description
    vo.isDone = entity.isDone
    vo.sortId = entity.sortId
    return vo
}

export const updateEvent2EventEntity = (updateEvent: UpdateEvent): EventEntity => {
    const entity = {} as EventEntity
    if (updateEvent.name !== undefined) {
        entity.name = updateEvent.name
    }
    if (updateEvent.description !== undefined) {
        entity.description = updateEvent.description || ''
    }
    if (updateEvent.isDone !== undefined) {
        entity.isDone = updateEvent.isDone
    }
    if (updateEvent.sortId !== undefined) {
        entity.sortId = updateEvent.sortId
    }
    return entity
}
