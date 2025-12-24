import type { EventEntity } from './entities'
import type {  GoAsync } from '@nao-todo/types'
import type { EventRepository } from './repositories'

interface EventDomain {
    get(eventId: string): GoAsync<EventEntity>
    create(eventEntity: EventEntity): GoAsync<EventEntity>
    update(eventId: string, eventEntity: EventEntity): GoAsync<string>
    remove(eventId: string): GoAsync<void> // like delete
    list(taskId: string): GoAsync<EventEntity[]>
}

export default (eventRepo: EventRepository): EventDomain => {
    return {
        get: eventRepo.get,
        create: eventRepo.create,
        update: eventRepo.update,
        remove: eventRepo.remove,
        list: eventRepo.list
    }
}
