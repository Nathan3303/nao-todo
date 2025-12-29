import type { ProjectEntity, ProjectPreferenceEntity } from './entities'
import type { CreateProjectVO, Err, Go, GoAsync, GoLike } from '@nao-todo/types'
import type { BuiltInProjectRepository, ProjectRepository } from './repositories'

/**
 * 项目领域服务
 */

interface ProjectDomain {
    get(projectId: string): GoAsync<ProjectEntity>
    create(createVO: CreateProjectVO): GoAsync<ProjectEntity>
    update(projectId: string, projectEntity: ProjectEntity): GoAsync<string>
    remove(projectId: string): Promise<Err> // like delete
    restore(projectId: string): Promise<Err>
    archive(projectId: string): Promise<Err>
    unarchive(projectId: string): Promise<Err>
    list(): Promise<GoLike<ProjectEntity[] | null>>
    getPreference(projectId: string): GoAsync<ProjectPreferenceEntity>
}

export const useProjectDomain = (projectRepo: ProjectRepository): ProjectDomain => {
    return {
        get: projectRepo.get,
        create: projectRepo.create,
        update: projectRepo.update,
        remove: projectRepo.remove,
        restore: projectRepo.restore,
        archive: projectRepo.archive,
        unarchive: projectRepo.unarchive,
        list: projectRepo.list,
        getPreference: projectRepo.getPreference
    }
}

/**
 * 内建项目领域服务
 */

export interface BuiltInProjectDomain {
    get(projectId: string): Go<ProjectEntity>
    list(): Go<ProjectEntity[]>
    getPreference(userId: string, projectId: string): Go<ProjectPreferenceEntity>
    savePreference(userId: string, ppe: ProjectPreferenceEntity): Err
}

export const useBuiltInProjectDomain = (
    builtInProjectRepo: BuiltInProjectRepository
): BuiltInProjectDomain => {
    return {
        get: builtInProjectRepo.get,
        list: builtInProjectRepo.list,
        getPreference: builtInProjectRepo.getPreference,
        savePreference: builtInProjectRepo.savePreference
    }
}
