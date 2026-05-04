import { TaskEntity } from '@nao-todo/domain/task/entities'
import type { CreateTaskRes, GetTaskRes, ListTaskRes, UpdateTaskReq } from '../types'
import { UpdateTaskValueObject } from '@nao-todo/domain/task'
import dayjs from 'dayjs'

export const getTaskRes2TaskEntity = (res: GetTaskRes): TaskEntity => {
    return new TaskEntity(
        res.id,
        '',
        '',
        '',
        res.name,
        res.description,
        res.state,
        res.priority,
        res.startAt,
        res.endAt,
        res.projectId,
        res.tags,
        res.createdAt,
        res.updatedAt,
        res.deletedAt,
        res.archivedAt,
        res.starMarkAt,
        res.givenUpAt
    )
}

export const createTaskRes2TaskEntity = (res: CreateTaskRes): TaskEntity => {
    return getTaskRes2TaskEntity(res)
}

export const listTaskRes2TaskEntities = (res: ListTaskRes): TaskEntity[] => {
    return res.map((task) => {
        return getTaskRes2TaskEntity(task)
    })
}

export const updateTaskValueObjectToReq = (valueObject: UpdateTaskValueObject): UpdateTaskReq => {
    const req = {} as UpdateTaskReq
    if (valueObject.name) req.name = valueObject.name
    if (valueObject.description) req.description = valueObject.description
    if (valueObject.state) req.state = valueObject.state
    if (valueObject.priority) req.priority = valueObject.priority
    if (valueObject.startAt) req.startAt = dayjs(valueObject.startAt).toISOString()
    if (valueObject.endAt) req.endAt = dayjs(valueObject.endAt).toISOString()
    if (valueObject.projectId) req.projectId = valueObject.projectId
    if (valueObject.tags) req.tags = valueObject.tags
    return req
}

