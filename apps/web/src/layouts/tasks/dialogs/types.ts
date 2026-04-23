import type { ProjectUseCase } from '@nao-todo/application/web/usecases/project'
import type { TagUseCase } from '@nao-todo/application/web/usecases/tag'

export type DialogManagerContext = {
    projectUseCase: ProjectUseCase
    tagUseCase: TagUseCase
}

