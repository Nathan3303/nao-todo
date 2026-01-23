import type { EventDomain } from '@nao-todo/domain/event'
import type { Event, GoAsync, Task } from '@nao-todo/types'
import { eventEntity2ViewObject } from '../converters/event'

export interface EventStore {
    addEvent: (event: Event) => void
    getEvent: (eventId: Event['id']) => Event | undefined
    setEvents: (events: Event[]) => void
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
        this.store.setEvents(events)
        return [events.map((event) => event.id), null]
    }
}
