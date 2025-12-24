import type { EventEntity } from '@nao-todo/domain/event'
import type { EventVO } from '@nao-todo/types'

export const eventEntity2VO = (entity: EventEntity): EventVO => {
    const vo = {} as EventVO
    vo.id = entity.id
    vo.taskId = entity.taskId
    vo.name = entity.name
    vo.description = entity.description
    vo.isDone = entity.isDone
    vo.sortId = entity.sortId
    return vo
}

export const eventEntities2VOs = (entities: EventEntity[]): EventVO[] => {
    return entities.map(eventEntity2VO)
}
