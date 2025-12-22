import type { GoAsync } from '@nao-todo/types'
import { TaskEntity } from './entities'

export interface TaskRepository {
    get(taskId: string): GoAsync<TaskEntity>
    create(taskEntity: TaskEntity): GoAsync<TaskEntity>
    update(taskId: string, taskEntity: TaskEntity): GoAsync<string>
    remove(taskId: string): GoAsync<void> // like delete
    restore(taskId: string): GoAsync<void>
    list(query?: string): GoAsync<TaskEntity[]>
}
