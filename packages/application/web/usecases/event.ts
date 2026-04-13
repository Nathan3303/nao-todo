import { type EventDomain } from '@nao-todo/domain/event'
import type { UpdateEventViewObject } from '@nao-todo/types'
import type { CreateEventViewObject, EventViewObject, GoAsync, Task } from '@nao-todo/types'
import {
    createEventViewObjectToValueObject,
    eventEntityToViewObject,
    updateEventViewObjectToValueObject
} from '../converters/event'

export interface EventStore {
    addEvent: (event: EventViewObject) => void
    getEvent: (eventId: EventViewObject['id']) => EventViewObject | undefined
    setEvents: (events: EventViewObject[]) => void
    setEventIds: (eventIds: EventViewObject['id'][]) => void
    addEventId: (eventId: EventViewObject['id']) => void
    updateEvent: (eventId: EventViewObject['id'], event: UpdateEventViewObject) => void
    deleteEvent: (eventId: EventViewObject['id']) => void
    removeEventId: (eventId: EventViewObject['id']) => void
    events?: EventViewObject[]
}

export class EventUseCase {
    /**
     * 检查事项用例
     * @param eventDomain 检查事项领域服务
     * @param store 检查事项存储
     */
    constructor(
        private eventDomain: EventDomain,
        private store: EventStore
    ) {}

    /**
     * 加载任务的检查事项列表
     * @param taskId 任务ID
     * @returns 检查事项ID列表
     */
    async loadEvents(taskId: Task['id']): GoAsync<EventViewObject['id'][]> {
        const [eventEntities, err] = await this.eventDomain.list(taskId)
        if (err !== null) return [null, err]
        const events = eventEntities.map(eventEntityToViewObject)
        const eventIds = events.map((event) => event.id)
        this.store.setEvents(events)
        this.store.setEventIds(eventIds)
        return [eventIds, null]
    }

    /**
     * 创建检查事项
     * @param createEventViewObject 创建检查事项视图对象
     * @returns 检查事项ID
     */
    async create(createEventViewObject: CreateEventViewObject): GoAsync<EventViewObject['id']> {
        // 转换为值对象
        const createEventValueObject = createEventViewObjectToValueObject(createEventViewObject)
        // 创建检查事项
        const [createdEntity, err] = await this.eventDomain.create(createEventValueObject)
        if (err !== null) return [null, err]
        // 转换为视图对象
        const newEvent = eventEntityToViewObject(createdEntity)
        // 添加到存储
        this.store.addEvent(newEvent)
        this.store.addEventId(newEvent.id)
        // 返回检查事项ID
        return [newEvent.id, null]
    }

    /**
     * 更新检查事项
     * @param eventId 检查事项ID
     * @param update 更新检查事项参数
     * @returns 更新后的检查事项ID
     */
    async update(
        eventId: EventViewObject['id'],
        updateEventViewObject: UpdateEventViewObject
    ): GoAsync<EventViewObject['id']> {
        // 转换为值对象
        const updateValueObject = updateEventViewObjectToValueObject(eventId, updateEventViewObject)
        // console.log(updateValueObject)
        // 更新检查事项
        const [updatedId, err] = await this.eventDomain.update(eventId, updateValueObject)
        if (err !== null) return [null, err]
        // 更新本地数据
        // console.log(updateEventViewObject)
        this.store.updateEvent(eventId, updateEventViewObject)
        // 返回检查事项ID
        return [updatedId, null]
    }

    /**
     * 删除事件
     * @param eventId 事件ID
     * @returns 删除后的事件ID
     */
    async delete(eventId: EventViewObject['id']): GoAsync<EventViewObject['id']> {
        // 删除检查事项
        const err = await this.eventDomain.remove(eventId)
        if (err !== null) return [null, err]
        // 删除本地数据
        this.store.deleteEvent(eventId)
        this.store.removeEventId(eventId)
        // 返回检查事项ID
        return [eventId, null]
    }

    /**
     * 重新排序事件
     * @param originalId 被拖拽事件ID
     * @param boundId 目标事件ID
     * @param isBefore 是否插入到目标之前
     * @returns 排序结果
     */
    async resort(
        originalId: EventViewObject['id'],
        boundId: EventViewObject['id'],
        isBefore: boolean
    ): GoAsync<void> {
        const originalEvent = this.store.getEvent(originalId)
        const boundEvent = this.store.getEvent(boundId)
        if (!originalEvent || !boundEvent) return '事件不存在'

        let originalSortId = originalEvent.sortId

        if (isBefore) {
            if (originalSortId >= boundEvent.sortId) {
                originalSortId = boundEvent.sortId - 1
            }
        } else {
            if (originalSortId <= boundEvent.sortId) {
                originalSortId = boundEvent.sortId + 1
            }
        }

        const [updatedId, err] = await this.update(originalId, { sortId: originalSortId })
        if (err !== null) return err

        this.store.updateEvent(updatedId, { sortId: originalSortId })
        return null
    }
}


