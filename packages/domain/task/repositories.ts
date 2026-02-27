import type { CreateTask, GoAsync, ResponseDataPagination } from '@nao-todo/types'
import { TaskEntity } from './entities'
import type { UpdateTask } from './valueobjects'

export interface TaskRepository {
    get(taskId: string): GoAsync<TaskEntity>
    create(createVO: CreateTask): GoAsync<TaskEntity>
    update(taskId: string, updateVO: UpdateTask): GoAsync<string>
    remove(taskId: string): GoAsync<void>
    restore(taskId: string): GoAsync<void>
    list(
        queryString?: string
    ): GoAsync<{ taskEntities: TaskEntity[]; pagination?: ResponseDataPagination }>
}
