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
    const e = new ProjectPreferenceEntity(
        '',
        '',
        '',
        res.viewType,
        res.getTasksOptions,
        res.columns
    )
    return e
}

export const preferenceEntity2UpdateProjectPreferenceReq = (
    preferenceEntity: ProjectPreferenceEntity
): UpdateProjectPreferenceReq => {
    const rto = { preference: {} } as UpdateProjectPreferenceReq
    rto.preference.viewType = preferenceEntity.viewType
    rto.preference.getTasksOptions = preferenceEntity.getTasksOptions
    rto.preference.columns = preferenceEntity.columns
    return rto
}
