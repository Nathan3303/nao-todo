import type { ProjectEntity, ProjectPreferenceEntity } from './entities'
import type { CreateProjectVO, Err, GoAsync, GoLike } from '@nao-todo/types'
import type { ProjectRepository } from './repositories'

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
    updatePreference(projectId: string, preferenceEntity: ProjectPreferenceEntity): GoAsync<string>
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
        getPreference: projectRepo.getPreference,
        updatePreference: projectRepo.updatePreference
    }
}
