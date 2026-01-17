import type {
    BuiltInProjectEntity,
    BuiltInProjectPreferenceValueObject
} from '@nao-todo/domain/built-in-project'
import type {
    BuiltInProject,
    BuiltInProjectPreference
} from '@nao-todo/infrastructure/built-in/project/types'

export const builtInProjectEntity2VO = (bipe: BuiltInProjectEntity): BuiltInProject => {
    const vo = {} as BuiltInProject
    vo.id = bipe.id
    vo.icon = bipe.icon
    vo.name = bipe.name
    vo.description = bipe.description
    vo.createTaskOptions = bipe.createTaskOptions
    return vo
}

export const builtInProjectEntities2VOs = (bipes: BuiltInProjectEntity[]): BuiltInProject[] => {
    return bipes.map(builtInProjectEntity2VO)
}

export const builtInProjectPreferenceValueObject2VO = (
    bippvo: BuiltInProjectPreferenceValueObject
): BuiltInProjectPreference => {
    const vo = {} as BuiltInProjectPreference
    vo.projectId = bippvo.projectId || ''
    vo.viewType = bippvo.viewType
    vo.getTasksOptions = bippvo.getTasksOptions
    vo.columns = bippvo.columns
    return vo
}

export const builtInProjectPreferenceVO2ValueObject = (
    bippvo: BuiltInProjectPreference
): BuiltInProjectPreferenceValueObject => {
    const vo = {} as BuiltInProjectPreferenceValueObject
    vo.projectId = bippvo.projectId
    vo.viewType = bippvo.viewType
    vo.getTasksOptions = bippvo.getTasksOptions
    vo.columns = bippvo.columns
    return vo
}
