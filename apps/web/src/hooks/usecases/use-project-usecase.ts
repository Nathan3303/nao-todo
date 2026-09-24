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
    const useCase = new ProjectUseCase(projectDomain, projectRepo, projectPreferenceRepo, store)
    // 阶段二 2A / W3：容器域（清单）已切本地优先 ⇒ web binding 对该域**不再套**离线只读闸门（ADR §5 M5）
    // （钩子仍保留给未切换的域；desktop binding 不提供该钩子 ⇒ 写路径不变）
    return useCaseBinding.decorateUseCase?.(useCase, 'project') ?? useCase
}