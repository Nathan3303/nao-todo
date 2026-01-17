import type { Err, GoLike, GoAsync, CreateProjectVO } from '@nao-todo/types'
import type { ProjectEntity, ProjectPreferenceEntity } from './entities'

export interface ProjectRepository {
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
