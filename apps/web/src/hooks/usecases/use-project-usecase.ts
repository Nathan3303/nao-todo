import { ProjectService, ProjectStore, ProjectUseCase } from '@nao-todo/domain-project'
import { ProjectPreferenceRepoImpl, ProjectRepoImpl } from '@nao-todo/infrastructure'
import { getRequesterImpl } from '@nao-todo/shared'

/**
 * 项目用例
 * @param store 项目存储
 * @returns 项目用例
 */
export const useProjectUseCase = (store: ProjectStore) => {
    const requester = getRequesterImpl()
    const projectRepo = new ProjectRepoImpl(requester)
    const projectPrefereneRepo = new ProjectPreferenceRepoImpl(requester)
    const projectDomain = new ProjectService(projectRepo, projectPrefereneRepo)
    return new ProjectUseCase(projectDomain, projectRepo, projectPrefereneRepo, store)
}