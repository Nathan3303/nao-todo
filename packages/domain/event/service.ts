import { EventEntity } from './entities'
import type { Err, GoLike } from '@nao-todo/types'
import type { EventRepository } from './repositories'

interface EventDomain {
    get(eventId: string): Promise<GoLike<EventEntity | null>>
    create(eventEntity: EventEntity): Promise<GoLike<EventEntity | null>>
    update(eventId: string, eventEntity: EventEntity): Promise<GoLike<string | null>>
    remove(eventId: string): Promise<Err> // like delete
    list(): Promise<GoLike<EventEntity[] | null>>
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
