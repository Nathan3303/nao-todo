import type {
    BuiltInProjectEntity,
    BuiltInProjectPreferenceEntity
} from '@nao-todo/domain/built-in-project'
import type { BuiltInProjectRes, BuiltInProjectPreferenceRes } from './types'

export const bipRes2bipEntity = (bipRes: BuiltInProjectRes): BuiltInProjectEntity => {
    const bipe = {} as BuiltInProjectEntity
    bipe.id = bipRes.id
    bipe.icon = bipRes.icon
    bipe.name = bipRes.name
    bipe.description = bipRes.description
    bipe.createTaskOptions = bipRes.createTaskOptions
    return bipe
}

export const bippRes2bippVO = (
    bippRes: BuiltInProjectPreferenceRes
): BuiltInProjectPreferenceEntity => {
    const bippvo = {} as BuiltInProjectPreferenceEntity
    bippvo.projectId = bippRes.projectId
    bippvo.viewType = bippRes.viewType
    bippvo.getTasksOptions = bippRes.getTasksOptions
    bippvo.columns = bippRes.columns
    return bippvo
}

export const bippVO2bippRes = (
    bippvo: BuiltInProjectPreferenceEntity
): BuiltInProjectPreferenceRes => {
    const bipp = {} as BuiltInProjectPreferenceRes
    bipp.projectId = bippvo.projectId || ''
    // bipp.userId = bippvo.userId || ''
    bipp.viewType = bippvo.viewType
    bipp.getTasksOptions = bippvo.getTasksOptions
    bipp.columns = bippvo.columns
    return bipp
}
