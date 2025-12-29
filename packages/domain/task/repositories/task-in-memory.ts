import type { Go } from '@nao-todo/types'
import type { TaskEntity } from '../entities'

export type TaskInMemoryRepositoryStates = {
    tasks: TaskEntity[]
    taskMap: Map<string, number>
}

export interface TaskInMemoryRepository {
    remakeTaskMap(): void
    getById(taskId: string): Go<TaskEntity>
    add(taskEntity: TaskEntity): void
    update(taskId: string, taskEntity: TaskEntity): void
    remove(taskId: string): void
    restore(taskId: string): void
    list(): TaskEntity[]
    setTasks(tasks: TaskEntity[]): void
}
