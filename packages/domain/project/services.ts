import type { ProjectEntity, ProjectPreferenceEntity } from './entities'
import type { CreateProject, GoAsync } from '@nao-todo/types'
import type { ProjectRepository } from './repositories'

export class ProjectDomain {
    constructor(private projectRepo: ProjectRepository) {}

    async get(projectId: string): GoAsync<ProjectEntity> {
        return this.projectRepo.get(projectId)
    }

    async create(createVO: CreateProject): GoAsync<ProjectEntity> {
        return this.projectRepo.create(createVO)
    }

    async update(projectId: string, projectEntity: ProjectEntity): GoAsync<string> {
        return this.projectRepo.update(projectId, projectEntity)
    }

    async remove(projectId: string): GoAsync<void> {
        return this.projectRepo.remove(projectId)
    }

    async restore(projectId: string): GoAsync<void> {
        return this.projectRepo.restore(projectId)
    }

    async archive(projectId: string): GoAsync<void> {
        return this.projectRepo.archive(projectId)
    }

    async unarchive(projectId: string): GoAsync<void> {
        return this.projectRepo.unarchive(projectId)
    }

    async list(): GoAsync<ProjectEntity[]> {
        return this.projectRepo.list()
    }

    async getPreference(projectId: string): GoAsync<ProjectPreferenceEntity> {
        return this.projectRepo.getPreference(projectId)
    }

    async updatePreference(
        projectId: string,
        preferenceEntity: ProjectPreferenceEntity
    ): GoAsync<string> {
        return this.projectRepo.updatePreference(projectId, preferenceEntity)
    }
}
