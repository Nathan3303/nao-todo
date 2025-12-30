import type { CreateTaskVO, GoAsync, ResponseDataPagination } from '@nao-todo/types'
import { TaskEntity } from '../entities'

export interface TaskRepository {
    get(taskId: string): GoAsync<TaskEntity>
    create(createVO: CreateTaskVO): GoAsync<TaskEntity>
    update(taskId: string, taskEntity: TaskEntity): GoAsync<string>
    remove(taskId: string): GoAsync<void>
    restore(taskId: string): GoAsync<void>
    list(
        queryString?: string
    ): GoAsync<{ taskEntities: TaskEntity[]; pagination?: ResponseDataPagination }>
}
