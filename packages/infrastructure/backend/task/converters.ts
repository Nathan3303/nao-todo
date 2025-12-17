import { TaskEntity } from '@nao-todo/domain/task/entities'
import type { CreateTaskRes, GetTaskRes, ListTaskRes } from '../types'

export const getTaskRes2TaskEntity = (res: GetTaskRes): TaskEntity => {
    const e = new TaskEntity()
    e.id = res.id
    e.projectId = res.projectId
    e.name = res.name
    e.description = res.description
    e.state = res.state
    e.priority = res.priority
    e.startAt = res.startAt
    e.endAt = res.endAt
    e.tags = res.tags
    e.createdAt = res.createdAt
    e.updatedAt = res.updatedAt
    e.isDeleted = res.isDeleted
    e.archivedAt = res.archivedAt
    e.isArchived = res.isArchived
    e.starMarkAt = res.starMarkAt
    e.isStarMarked = res.isStarMarked
    e.givenUpAt = res.givenUpAt
    e.isGivenUp = res.isGivenUp
    return e
}

export const createTaskRes2TaskEntity = (res: CreateTaskRes): TaskEntity => {
    return getTaskRes2TaskEntity(res)
}

export const listTaskRes2TaskEntities = (res: ListTaskRes): TaskEntity[] => {
    return res.map((task) => {
        return getTaskRes2TaskEntity(task)
    })
}
