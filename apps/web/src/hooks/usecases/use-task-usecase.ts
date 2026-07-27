import { TaskDomain } from '@nao-todo/domain/task'
import type { TaskStore } from '@nao-todo/application/task/viewobjects'
import { TaskUseCase } from '@nao-todo/application/task/usecases'
import { TaskRepoImpl } from '@nao-todo/infrastructure/backend'
import { getRequesterImpl } from '@nao-todo/shared'

export const useTaskUseCase = (store: TaskStore) => {
    const requester = getRequesterImpl()
    const taskRepo = new TaskRepoImpl(requester)
    const taskDomain = new TaskDomain(taskRepo)
    return new TaskUseCase(taskDomain, taskRepo, store)
}