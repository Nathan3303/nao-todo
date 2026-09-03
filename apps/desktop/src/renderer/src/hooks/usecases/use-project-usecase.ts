import { ProjectService, ProjectStore, ProjectUseCase } from '@nao-todo/domain-project'
import {
    newLocalProjectPreferenceRepository,
    newLocalProjectRepository
} from '@nao-todo/infrastructure'

/**
 * 项目用例（桌面版本地仓储）
 * @param store 项目存储
 * @returns 项目用例
 */
export const useProjectUseCase = (store: ProjectStore) => {
    const projectRepo = newLocalProjectRepository()
    const projectPreferenceRepo = newLocalProjectPreferenceRepository()
    const projectDomain = new ProjectService(projectRepo, projectPreferenceRepo)
    return new ProjectUseCase(projectDomain, projectRepo, projectPreferenceRepo, store)
}