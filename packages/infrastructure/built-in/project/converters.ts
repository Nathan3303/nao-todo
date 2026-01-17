import type {
    BuiltInProjectEntity,
    BuiltInProjectPreferenceValueObject
} from '@nao-todo/domain/built-in-project'
import type { BuiltInProject, BuiltInProjectPreference } from './types'

export const builtInProjectRes2Entity = (bip: BuiltInProject): BuiltInProjectEntity => {
    const bipe = {} as BuiltInProjectEntity
    bipe.id = bip.id
    bipe.icon = bip.icon
    bipe.name = bip.name
    bipe.description = bip.description
    bipe.createTaskOptions = bip.createTaskOptions
    return bipe
}

export const builtInProjectPreferenceRes2VO = (
    bipp: BuiltInProjectPreference
): BuiltInProjectPreferenceValueObject => {
    const bippvo = {} as BuiltInProjectPreferenceValueObject
    bippvo.projectId = bipp.projectId
    bippvo.viewType = bipp.viewType
    bippvo.getTasksOptions = bipp.getTasksOptions
    bippvo.columns = bipp.columns
    return bippvo
}

export const projectPreferenceEntity2BuiltInPp = (
    bippvo: BuiltInProjectPreferenceValueObject
): BuiltInProjectPreference => {
    const bipp = {} as BuiltInProjectPreference
    bipp.projectId = bippvo.projectId || ''
    bipp.viewType = bippvo.viewType
    bipp.getTasksOptions = bippvo.getTasksOptions
    bipp.columns = bippvo.columns
    return bipp
}
