import {
    ProjectService,
    ProjectStore,
    ProjectUseCase,
    type ProjectTaskCascadePort
} from '@nao-todo/domain-project'
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
    // 归档级联端口（可选）：本地任务仓储提供「清单 + 任务同一 Dexie rw 事务」批量方法
    // （ADR `2026-09-24-project-archive.md` §4 Q1）；远端/mobile 不提供 ⇒ 回退单表写入
    const taskRepo = useCaseBinding.createTaskRepository()
    const taskCascade: ProjectTaskCascadePort | undefined =
        typeof taskRepo.archiveByProjectId === 'function' &&
        typeof taskRepo.unarchiveByProjectId === 'function'
            ? {
                  archiveByProjectId: (id) => taskRepo.archiveByProjectId!(id),
                  unarchiveByProjectId: (id) => taskRepo.unarchiveByProjectId!(id)
              }
            : undefined
    const useCase = new ProjectUseCase(
        projectDomain,
        projectRepo,
        projectPreferenceRepo,
        store,
        taskCascade
    )
    // 阶段二 2A / W3：容器域（清单）已切本地优先 ⇒ web binding 对该域**不再套**离线只读闸门（ADR §5 M5）
    // （钩子仍保留给未切换的域；desktop binding 不提供该钩子 ⇒ 写路径不变）
    return useCaseBinding.decorateUseCase?.(useCase, 'project') ?? useCase
}