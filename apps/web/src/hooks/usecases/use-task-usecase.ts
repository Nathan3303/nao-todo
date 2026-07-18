import { TaskDomain, TaskStore, TaskUseCase } from '@nao-todo/domain/task'
import { TaskRepoImpl } from '@nao-todo/infrastructure/backend'
import { getRequesterImpl } from '@nao-todo/shared'

export const useTaskUseCase = (store: TaskStore) => {
    const requester = getRequesterImpl()
    const taskRepo = new TaskRepoImpl(requester)
    const taskDomain = new TaskDomain(taskRepo)
    return new TaskUseCase(taskDomain, taskRepo, store)
}

