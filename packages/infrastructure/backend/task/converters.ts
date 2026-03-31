import { TaskEntity } from '@nao-todo/domain/task/entities'
import type { CreateTaskRes, GetTaskRes, ListTaskRes } from '../types'

export const getTaskRes2TaskEntity = (res: GetTaskRes): TaskEntity => {
    return new TaskEntity(
        res.id,
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
