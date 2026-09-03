import {
    ProjectService,
    ProjectUseCase,
    type CreateProjectViewObject,
    type UpdateProjectViewObject
} from '@nao-todo/domain-project'
import { ProjectPreferenceRepoImpl } from '@nao-todo/infrastructure/src/persistence-go/project/project-preference-repo-impl'
import { ProjectRepoImpl } from '@nao-todo/infrastructure/src/persistence-go/project/project-repo-impl'
import type { Requester } from '@nao-todo/shared/requester/types'
import type { GoError } from '@nao-todo/shared/types'
import type { ProjectStoreCore } from './project-store-core'

/**
 * 项目用例接口（组合后的门面）
 * @description 封装 domain-project 的 ProjectUseCase（含偏好），页面只消费本接口。
 */
export type ComposedProjectUseCase = {
    loadProjects: () => Promise<GoError>
    createProject: (
        viewObject: CreateProjectViewObject
    ) => ReturnType<ProjectUseCase['createProject']>
    updateProject: (id: string, update: UpdateProjectViewObject) => Promise<GoError>
    deleteProject: (projectId: string) => Promise<GoError>
    restoreProject: (projectId: string) => Promise<GoError>
}

/**
 * 组装项目用例
 * @description Requester → Repos（项目 + 偏好）→ ProjectService → ProjectUseCase
 * @param requester 请求器
 * @param store 项目存储（实现 ProjectStore）
 * @returns 项目用例门面
 */
export const composeProjectUseCase = (
    requester: Requester,
    store: ProjectStoreCore
): ComposedProjectUseCase => {
    const projectRepo = new ProjectRepoImpl(requester)
    const preferenceRepo = new ProjectPreferenceRepoImpl(requester)
    const projectService = new ProjectService(projectRepo, preferenceRepo)
    const projectUseCase = new ProjectUseCase(projectService, projectRepo, preferenceRepo, store)

    return {
        loadProjects: () => projectUseCase.loadProjects(),
        createProject: (viewObject) => projectUseCase.createProject(viewObject),
        updateProject: (id, update) => projectUseCase.update(id, update),
        deleteProject: (projectId) => projectUseCase.delete(projectId),
        restoreProject: (projectId) => projectUseCase.restore(projectId)
    }
}