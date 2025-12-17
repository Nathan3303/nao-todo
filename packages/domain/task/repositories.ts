import { Err, GoLike } from '@nao-todo/types'
import { TaskEntity } from './entities'

export interface TaskRepository {
    get(taskId: string): Promise<GoLike<TaskEntity | null>>
    create(taskEntity: TaskEntity): Promise<GoLike<TaskEntity | null>>
    update(taskId: string, taskEntity: TaskEntity): Promise<GoLike<string | null>>
    remove(taskId: string): Promise<Err> // like delete
    restore(taskId: string): Promise<Err>
    list(): Promise<GoLike<TaskEntity[] | null>>
}
