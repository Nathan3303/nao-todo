import { ProjectEntity, ProjectPreferenceEntity } from '@nao-todo/domain/project'
import type {
    CreateProjectRes,
    GetProjectPreferenceRes,
    GetProjectRes,
    ListProjectRes,
    UpdateProjectPreferenceReq
} from '../types'

export const getProjectRes2ProjectEntity = (res: GetProjectRes): ProjectEntity => {
    const e = new ProjectEntity(res.id, res.name, 'more2', res.description, res.archivedAt, '', '')
    return e
}

export const createProjectRes2ProjectEntity = (res: CreateProjectRes): ProjectEntity => {
    return getProjectRes2ProjectEntity(res)
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

