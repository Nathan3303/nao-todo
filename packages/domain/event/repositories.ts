import type { GoAsync } from '@nao-todo/types'
import type { EventEntity } from './entities'

export interface EventRepository {
    get(eventId: string): GoAsync<EventEntity>
    create(eventEntity: EventEntity): GoAsync<EventEntity>
    update(eventId: string, eventEntity: EventEntity): GoAsync<string>
    remove(eventId: string): GoAsync<void> // like delete
    list(taskId: string): GoAsync<EventEntity[]>
}
