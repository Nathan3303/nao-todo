import type { TaskEntity } from '@nao-todo/domain/task'
import type { ListTaskOptionsValueObject } from '@nao-todo/domain/task/valueobjs'
import type { GetTasksOptions, TaskVO } from '@nao-todo/types'

export const taskEntity2VO = (entity: TaskEntity): TaskVO => {
    const vo = {} as TaskVO
    vo.id = entity.id
    vo.name = entity.name
    vo.description = entity.description
    vo.state = ['todo', 'in-progress', 'done'].includes(entity.state)
        ? (entity.state as TaskVO['state'])
        : 'todo'
    vo.priority = ['low', 'medium', 'high', 'urgent'].includes(entity.priority)
        ? (entity.priority as TaskVO['priority'])
        : 'low'
    vo.tags = entity.tags
    vo.startAt = entity.startAt
    vo.endAt = entity.endAt
    vo.isDeleted = entity.isDeleted
    vo.isArchived = entity.isArchived
    vo.archivedAt = entity.archivedAt
    vo.isFavorited = entity.isStarMarked
    vo.isGivenUp = entity.isGivenUp
    vo.createdAt = entity.createdAt
    vo.updatedAt = entity.updatedAt
    return vo
}

export const taskEntities2VOs = (entities: TaskEntity[]): TaskVO[] => {
    return entities.map(taskEntity2VO)
}

export const getTasksOptions2ValueObject = (
    options?: GetTasksOptions
): ListTaskOptionsValueObject => {
    const vo = {} as ListTaskOptionsValueObject
    vo.projectId = options?.projectId
    vo.tagId = options?.tagId
    vo.name = options?.name
    vo.state = options?.state
    vo.priority = options?.priority
    vo.isDeleted = options?.isDeleted
    vo.page = options?.page
    vo.limit = options?.limit
    vo.sort = options?.sort
    vo.relativeDate = options?.relativeDate
    return vo
}
