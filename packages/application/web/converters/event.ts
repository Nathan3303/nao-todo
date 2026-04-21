import type { CreateEventViewObject, EventViewObject, UpdateEventViewObject } from '@nao-todo/types'
import { EventEntity, CreateEventValueObject, UpdateEventValueObject } from '@nao-todo/domain/event'

/**
 * 创建事件视图对象转换为值对象
 * @param createEvent 创建事件视图对象
 * @returns 创建事件值对象
 */
export const createEventViewObjectToValueObject = (
    createEvent: CreateEventViewObject
): CreateEventValueObject => {
    return new CreateEventValueObject(createEvent.taskId, createEvent.name, false, false)
}

/**
 * 事件实体转换为视图对象
 * @param eventEntity 事件实体
 * @returns 事件视图对象
 */
export const eventEntityToViewObject = (eventEntity: EventEntity): EventViewObject => {
    return {
        id: eventEntity.id,
        taskId: eventEntity.taskId,
        name: eventEntity.name,
        isDone: eventEntity.isDone,
        sortId: eventEntity.sortId
    } as EventViewObject
}

/**
 * 更新事件视图对象转换为值对象
 * @param updateEventId 更新事件ID
 * @param updateEventViewObject 更新事件视图对象
 * @returns 更新事件值对象
 */
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

