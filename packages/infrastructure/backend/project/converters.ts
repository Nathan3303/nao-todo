import { ProjectEntity } from '@nao-todo/domain/project/entities'
import type { CreateProjectRes, GetProjectRes, ListProjectRes } from '../types'

export const getProjectRes2ProjectEntity = (res: GetProjectRes): ProjectEntity => {
    const e = new ProjectEntity()
    e.id = res.id
    e.name = res.name
    e.description = res.description
    e.archivedAt = res.archivedAt
    // e.createdAt = res.createdAt
    // e.updatedAt = res.updatedAt
    return e
}

export const createProjectRes2ProjectEntity = (res: CreateProjectRes): ProjectEntity => {
    const e = new ProjectEntity()
    e.id = res.id
    e.name = res.name
    e.description = res.description
    e.archivedAt = res.archivedAt
    // e.createdAt = res.createdAt
    // e.updatedAt = res.updatedAt
    return e
}

export const listProjectRes2ProjectEntities = (res: ListProjectRes): ProjectEntity[] => {
    return res.map((p) => {
        const e = new ProjectEntity()
        e.id = p.id
        e.name = p.name
        e.description = p.description
        e.archivedAt = p.archivedAt
        // e.createdAt = p.createdAt
        // e.updatedAt = p.updatedAt
        return e
    })
}
