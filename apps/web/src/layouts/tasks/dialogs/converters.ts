import type { ProjectCreatorVO } from '@/components/tasks/dialogs/project-creator/types'
import type { TagCreatorVO } from '@/components/tasks/dialogs/tag-creator/types'
import type { CreateProjectViewObject, CreateTagViewObject } from '@nao-todo/types'

export const projectCreatorVO2ValueObject = (vo: ProjectCreatorVO): CreateProjectViewObject => {
    const req = {} as CreateProjectViewObject
    if (vo.name) req.name = vo.name
    if (vo.description) req.description = vo.description
    return req
}

export const tagCreatorVO2ValueObject = (vo: TagCreatorVO): CreateTagViewObject => {
    const req = {} as CreateTagViewObject
    if (vo.name) req.name = vo.name
    if (vo.description) req.description = vo.description
    if (vo.color) req.color = vo.color
    return req
}
