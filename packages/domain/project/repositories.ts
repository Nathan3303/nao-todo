import { Err, GoLike } from '@nao-todo/types'
import { ProjectEntity } from './entities'

export interface ProjectRepository {
    get(projectId: string): Promise<GoLike<ProjectEntity | null>>
    create(projectEntity: ProjectEntity): Promise<GoLike<ProjectEntity | null>>
    update(projectId: string, projectEntity: ProjectEntity): Promise<GoLike<string | null>>
    remove(projectId: string): Promise<Err> // like delete
    restore(projectId: string): Promise<Err>
    archive(projectId: string): Promise<Err>
    unarchive(projectId: string): Promise<Err>
    list(): Promise<GoLike<ProjectEntity[] | null>>
}
