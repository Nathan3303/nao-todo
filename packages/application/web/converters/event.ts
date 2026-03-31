import type { CreateEventViewObject, EventViewObject, UpdateEventViewObject } from '@nao-todo/types'
import { EventEntity, CreateEventValueObject, UpdateEventValueObject } from '@nao-todo/domain/event'

export const createEventViewObjectToValueObject = (
    createEvent: CreateEventViewObject
): CreateEventValueObject => {
    return new CreateEventValueObject(createEvent.taskId, createEvent.name, false, false)
}

export const eventEntityToViewObject = (eventEntity: EventEntity): EventViewObject => {
    return {
        id: eventEntity.id,
        taskId: eventEntity.taskId,
        name: eventEntity.name,
        isDone: eventEntity.isDone,
        sortId: eventEntity.sortId
    } as EventViewObject
}

export const updateEventViewObjectToValueObject = (
    updateEventId: string,
    updateEventViewObject: UpdateEventViewObject
): UpdateEventValueObject => {
    const updateEventValueObject = new UpdateEventValueObject(updateEventId)
    updateEventValueObject.name = updateEventViewObject.name
    updateEventValueObject.isDone = updateEventViewObject.isDone
    updateEventValueObject.sortId = updateEventViewObject.sortId
    return updateEventValueObject
}
