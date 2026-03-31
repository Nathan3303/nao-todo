import type { GoAsync } from '@nao-todo/types'
import type { EventEntity } from './entities'
import { CreateEventValueObject, UpdateEventValueObject } from './valueobjects'

export interface EventRepository {
    get(eventId: string): GoAsync<EventEntity>
    create(createEventValueObject: CreateEventValueObject): GoAsync<EventEntity>
    update(eventId: string, updateEventValueObject: UpdateEventValueObject): GoAsync<string>
    remove(eventId: string): GoAsync<void> // like delete
    list(taskId: string): GoAsync<EventEntity[]>
}
