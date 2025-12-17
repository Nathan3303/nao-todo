import { Err, GoLike } from '@nao-todo/types'
import { EventEntity } from './entities'

export interface EventRepository {
    get(eventId: string): Promise<GoLike<EventEntity | null>>
    create(eventEntity: EventEntity): Promise<GoLike<EventEntity | null>>
    update(eventId: string, eventEntity: EventEntity): Promise<GoLike<string | null>>
    remove(eventId: string): Promise<Err> // like delete
    list(): Promise<GoLike<EventEntity[] | null>>
}
