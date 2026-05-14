import {
    ProjectEntity,
    ProjectPreferenceEntity,
    UpdateProjectValueObject
} from '@nao-todo/domain/project'
import type {
    CreateProjectRes,
    GetProjectPreferenceRes,
    GetProjectRes,
    ListProjectRes,
    UpdateProjectPreferenceReq,
    BatchUpdateProjectRes,
    UpdateProjectReq
} from '../types'

export const getProjectRes2ProjectEntity = (res: GetProjectRes): ProjectEntity => {
    const e = new ProjectEntity(
        res.id,
        res.name,
        'more2',
        res.description,
        res.archivedAt,
        res.createdAt,
        res.updatedAt,
        res.deactivedAt,
        res.sortId
    )
    return e
}

export const createProjectRes2ProjectEntity = (res: CreateProjectRes): ProjectEntity => {
    return getProjectRes2ProjectEntity(res)
}

export const updateProjectValueObjectToUpdateProjectReq = (
    updateProjectValueObject: UpdateProjectValueObject
): UpdateProjectReq => {
    const rto: UpdateProjectReq = {}
    if (updateProjectValueObject.id) rto.id = updateProjectValueObject.id
    if (updateProjectValueObject.name) rto.name = updateProjectValueObject.name
    if (updateProjectValueObject.description) rto.description = updateProjectValueObject.description
    if (updateProjectValueObject.sortId !== undefined) rto.sortId = updateProjectValueObject.sortId
    return rto
}

export const listProjectRes2ProjectEntities = (res: ListProjectRes): ProjectEntity[] => {
    return res.map((project) => getProjectRes2ProjectEntity(project))
}

export const getProjectPreferenceRes2ProjectPreferenceEntity = (
    res: GetProjectPreferenceRes
): ProjectPreferenceEntity => {
    return new ProjectPreferenceEntity(
        res.id,
        res.projectId,
        res.viewType,
        res.getTasksOptions,
        res.columns,
        res.createdAt,
        res.updatedAt
    )
}

export const preferenceEntity2UpdateProjectPreferenceReq = (
    preferenceEntity: ProjectPreferenceEntity
): UpdateProjectPreferenceReq => {
    const rto = {} as UpdateProjectPreferenceReq
    rto.viewType = preferenceEntity.viewType
    rto.getTasksOptions = preferenceEntity.getTasksOptions
    rto.columns = preferenceEntity.columns
    return rto
}

export const batchUpdateProjectRes2BatchUpdateProjectResult = (res: BatchUpdateProjectRes) => {
    return {
        updatedCount: res.updatedCount,
        projects: res.projects.map((project) => getProjectRes2ProjectEntity(project))
    }
}

