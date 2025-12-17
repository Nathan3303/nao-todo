import { ProjectEntity } from './entities'
import type { Err, GoLike } from '@nao-todo/types'
import type { ProjectRepository } from './repositories'

interface ProjectDomain {
    get(projectId: string): Promise<GoLike<ProjectEntity | null>>
    create(projectEntity: ProjectEntity): Promise<GoLike<ProjectEntity | null>>
    update(projectId: string, projectEntity: ProjectEntity): Promise<GoLike<string | null>>
    remove(projectId: string): Promise<Err> // like delete
    restore(projectId: string): Promise<Err>
    archive(projectId: string): Promise<Err>
    unarchive(projectId: string): Promise<Err>
    list(): Promise<GoLike<ProjectEntity[] | null>>
}

export default (projectRepo: ProjectRepository): ProjectDomain => {
    return {
        get: projectRepo.get,
        create: projectRepo.create,
        update: projectRepo.update,
        remove: projectRepo.remove,
        restore: projectRepo.restore,
        archive: projectRepo.archive,
        unarchive: projectRepo.unarchive,
        list: projectRepo.list
    }
}
