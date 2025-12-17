import { TaskEntity } from './entities'
import type { Err, GoLike } from '@nao-todo/types'
import type { TaskRepository } from './repositories'

interface TaskDomain {
    get(taskId: string): Promise<GoLike<TaskEntity | null>>
    create(taskEntity: TaskEntity): Promise<GoLike<TaskEntity | null>>
    update(taskId: string, taskEntity: TaskEntity): Promise<GoLike<string | null>>
    remove(taskId: string): Promise<Err> // like delete
    restore(taskId: string): Promise<Err>
    list(): Promise<GoLike<TaskEntity[] | null>>
}

export default (taskRepo: TaskRepository): TaskDomain => {
    return {
        get: taskRepo.get,
        create: taskRepo.create,
        update: taskRepo.update,
        remove: taskRepo.remove,
        restore: taskRepo.restore,
        list: taskRepo.list
    }
}
