import {
    makeProjectEntity,
    makeProjectPreferenceEntity,
    type ProjectPreferenceEntity,
    type ProjectEntity
} from '@nao-todo/domain/project/entities'
import type { BuiltInProject, BuiltInProjectPreference } from './types'

export const parse2ProjectEntity = (p: BuiltInProject): ProjectEntity => {
    const e = makeProjectEntity()
    e.id = p.id
    e.icon = p.icon
    e.name = p.name
    e.description = p.description
    // e.preference = p.preference
    // e.createTasksOptions = p.createTasksOptions
    return e
}

export const parse2ProjectPreferenceEntity = (
    pp: BuiltInProjectPreference
): ProjectPreferenceEntity => {
    const e = makeProjectPreferenceEntity()
    e.projectId = pp.projectId
    e.viewType = pp.viewType
    e.getTasksOptions = pp.getTasksOptions
    e.columns = pp.columns
    return e
}

export const projectPreferenceEntity2BuiltInPp = (
    ppe: ProjectPreferenceEntity
): BuiltInProjectPreference => {
    const pp = {} as BuiltInProjectPreference
    pp.viewType = ppe.viewType
    pp.getTasksOptions = ppe.getTasksOptions
    pp.columns = ppe.columns
    return pp
}
