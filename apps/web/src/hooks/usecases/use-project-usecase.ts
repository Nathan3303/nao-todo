import { ProjectDomain } from '@nao-todo/domain/project'
import type { ProjectStore } from '@nao-todo/application/project/viewobjects'
import { ProjectUseCase } from '@nao-todo/application/project/usecases'
import { ProjectPreferenceRepoImpl, ProjectRepoImpl } from '@nao-todo/infrastructure/backend'
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
    const projectDomain = new ProjectDomain(projectRepo)
    return new ProjectUseCase(projectDomain, projectRepo, projectPrefereneRepo, store)
}