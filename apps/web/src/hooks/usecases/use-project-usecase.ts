import { ProjectService, ProjectStore, ProjectUseCase } from '@nao-todo/domain-project'
import { useCaseBinding } from '@/hooks/usecases/binding'

/**
 * 项目用例
 * @param store 项目存储
 * @returns 项目用例
 */
export const useProjectUseCase = (store: ProjectStore) => {
    const projectRepo = useCaseBinding.createProjectRepository()
    const projectPreferenceRepo = useCaseBinding.createProjectPreferenceRepository()
    const projectDomain = new ProjectService(projectRepo, projectPreferenceRepo)
    return new ProjectUseCase(projectDomain, projectRepo, projectPreferenceRepo, store)
}