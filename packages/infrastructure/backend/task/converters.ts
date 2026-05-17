import { TaskEntity } from '@nao-todo/domain/task/entities'
import type { CreateTaskRes, GetTaskRes, ListTaskRes, UpdateTaskReq } from '../types'
import { UpdateTaskValueObject } from '@nao-todo/domain/task'

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
        res.givenUpAt,
        res.remindAt || '',
        res.remindRepeat || 'none',
        res.remindTime || '',
        res.remindWeekdays || []
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
    if (valueObject.startAt !== void 0) req.startAt = valueObject.startAt
    if (valueObject.endAt !== void 0) req.endAt = valueObject.endAt
    if (valueObject.projectId) req.projectId = valueObject.projectId
    if (valueObject.tags) req.tags = valueObject.tags
    if (valueObject.givenUpAt !== void 0) req.givenUpAt = valueObject.givenUpAt
    if (valueObject.remindAt !== undefined) req.remindAt = valueObject.remindAt
    if (valueObject.remindRepeat !== undefined) req.remindRepeat = valueObject.remindRepeat
    if (valueObject.remindTime !== undefined) req.remindTime = valueObject.remindTime
    if (valueObject.remindWeekdays !== undefined) req.remindWeekdays = valueObject.remindWeekdays
    return req
}

