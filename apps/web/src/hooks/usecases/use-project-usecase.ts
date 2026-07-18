import { ProjectDomain } from '@nao-todo/domain/project'
import { ProjectRepoImpl } from '@nao-todo/infrastructure/backend'
import { getRequesterImpl } from '@nao-todo/shared'

export const useProjectUseCase = (store: ProjectStore) => {
    const requester = getRequesterImpl()
    const projectRepo = new ProjectRepoImpl(requester)
    const projectDomain = new ProjectDomain(projectRepo)
    return new ProjectUseCase(projectDomain, projectRepo, store)
}

