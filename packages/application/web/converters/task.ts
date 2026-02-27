import type { TaskEntity } from '@nao-todo/domain/task'
import type { UpdateTask } from '@nao-todo/domain/task/valueobjects'
import type { Task, UpdateTaskOptions } from '@nao-todo/types'

export const taskEntity2ViewObject = (entity: TaskEntity): Task => {
    const vo = {} as Task
    vo.id = entity.id
    vo.name = entity.name
    vo.projectId = entity.projectId
    vo.description = entity.description
    vo.state = ['todo', 'in-progress', 'done'].includes(entity.state)
        ? (entity.state as Task['state'])
        : 'todo'
    vo.priority = ['low', 'medium', 'high', 'urgent'].includes(entity.priority)
        ? (entity.priority as Task['priority'])
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

export const taskEntities2ViewObjects = (entities: TaskEntity[]): Task[] => {
    return entities.map(taskEntity2ViewObject)
}

export const updateTaskOptions2UpdateValueObject = (options: UpdateTaskOptions): UpdateTask => {
    const vo = {} as UpdateTask
    vo.projectId = options.projectId
    vo.name = options.name
    vo.description = options.description
    vo.state = options.state
    vo.priority = options.priority
    vo.startAt = options.startAt
    vo.endAt = options.endAt
    vo.tags = options.tags
    return vo
}
