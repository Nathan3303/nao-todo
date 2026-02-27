import type { EventDomain } from '@nao-todo/domain/event'
import type { CreateEvent, Event, GoAsync, Task, UpdateEvent } from '@nao-todo/types'
import {
    createEvent2EventEntity,
    eventEntity2ViewObject,
    updateEvent2EventEntity
} from '../converters/event'

export interface EventStore {
    addEvent: (event: Event) => void
    getEvent: (eventId: Event['id']) => Event | undefined
    setEvents: (events: Event[]) => void
    setEventIds: (eventIds: Event['id'][]) => void
    addEventId: (eventId: Event['id']) => void
    updateEvent: (eventId: Event['id'], event: UpdateEvent) => void
    deleteEvent: (eventId: Event['id']) => void
    removeEventId: (eventId: Event['id']) => void
}

export class EventUseCase {
    /**
     * 事件用例
     * @param eventDomain 事件领域服务
     * @param store 事件存储
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
    async loadEvents(taskId: Task['id']): GoAsync<Event['id'][]> {
        const [eventEntities, err] = await this.eventDomain.list(taskId)
        if (err !== null) {
            return [null, err]
        }
        const events = eventEntities.map(eventEntity2ViewObject)
        const eventIds = events.map((event) => event.id)
        this.store.setEvents(events)
        this.store.setEventIds(eventIds)
        return [eventIds, null]
    }

    /**
     * 创建事件
     * @param event 创建事件参数
     * @returns 事件ID
     */
    async create(event: CreateEvent): GoAsync<Event['id']> {
        const eventEntity = createEvent2EventEntity(event)
        const [createdEntity, err] = await this.eventDomain.create(eventEntity)
        if (err !== null) {
            return [null, err]
        }
        const newEvent = eventEntity2ViewObject(createdEntity)
        this.store.addEvent(newEvent)
        this.store.addEventId(newEvent.id)
        return [newEvent.id, null]
    }

    /**
     * 更新事件
     * @param eventId 事件ID
     * @param update 更新事件参数
     * @returns 更新后的事件ID
     */
    async update(eventId: Event['id'], update: UpdateEvent): GoAsync<Event['id']> {
        const updateEntity = updateEvent2EventEntity(update)
        const [updatedId, err] = await this.eventDomain.update(eventId, updateEntity)
        if (err !== null) {
            return [null, err]
        }
        this.store.updateEvent(updatedId, update)
        return [updatedId, null]
    }

    /**
     * 删除事件
     * @param eventId 事件ID
     * @returns 删除后的事件ID
     */
    async delete(eventId: Event['id']): GoAsync<Event['id']> {
        const err = await this.eventDomain.remove(eventId)
        if (err !== null) {
            return [null, err]
        }
        this.store.deleteEvent(eventId)
        this.store.removeEventId(eventId)
        return [eventId, null]
    }

    /**
     * 重新排序事件
     * @param eventIds 事件ID列表
     * @returns 排序后的事件ID列表
     */
    async resort(originalId: Event['id'], boundId: Event['id'], isBefore: boolean): GoAsync<void> {
        // 1. 获取检查事项数据
        const originalEvent = this.store.getEvent(originalId)
        const boundEvent = this.store.getEvent(boundId)
        if (!originalEvent || !boundEvent) return '事件不存在'
        // 2. 处理排序
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
        // 3. 更新数据库
        const [updatedId, err] = await this.update(originalId, { sortId: originalSortId })
        if (err !== null) {
            return err
        }
        // 4. 更新本地数据
        this.store.updateEvent(updatedId, { sortId: originalSortId })
        return null
    }
}
