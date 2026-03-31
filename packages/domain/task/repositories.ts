import type { GoAsync, ResponseDataPagination } from '@nao-todo/types'
import { TaskEntity } from './entities'
import { CreateTaskValueObject, UpdateTaskValueObject } from './valueobjects'

export interface TaskRepository {
    get(taskId: string): GoAsync<TaskEntity>
    create(createTaskValueObject: CreateTaskValueObject): GoAsync<TaskEntity>
    update(taskId: string, updateTaskValueObject: UpdateTaskValueObject): GoAsync<string>
    remove(taskId: string): GoAsync<void>
    restore(taskId: string): GoAsync<void>
    list(
        queryString?: string
    ): GoAsync<{ taskEntities: TaskEntity[]; pagination?: ResponseDataPagination }>
}
