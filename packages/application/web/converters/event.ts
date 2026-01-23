import type { EventEntity } from '@nao-todo/domain/event'
import type { Event } from '@nao-todo/types'

export const eventEntity2ViewObject = (entity: EventEntity): Event => {
    const vo = {} as Event
    vo.id = entity.id
    vo.taskId = entity.taskId
    vo.name = entity.name
    vo.description = entity.description
    vo.isDone = entity.isDone
    vo.sortId = entity.sortId
    return vo
}