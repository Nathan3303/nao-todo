import type { GoAsync, CreateProject } from '@nao-todo/types'
import type { ProjectEntity, ProjectPreferenceEntity } from './entities'

export interface ProjectRepository {
    get(projectId: string): GoAsync<ProjectEntity>
    create(createVO: CreateProject): GoAsync<ProjectEntity>
    update(projectId: string, projectEntity: ProjectEntity): GoAsync<string>
    remove(projectId: string): GoAsync<void> // like delete
    restore(projectId: string): GoAsync<void>
    archive(projectId: string): GoAsync<void>
    unarchive(projectId: string): GoAsync<void>
    list(): GoAsync<ProjectEntity[]>
    getPreference(projectId: string): GoAsync<ProjectPreferenceEntity>
    updatePreference(projectId: string, preferenceEntity: ProjectPreferenceEntity): GoAsync<string>
}
