import type { TaskCheckItemStore } from '@nao-todo/domain-task/viewobjects'
import { TaskCheckItemUseCase } from '@nao-todo/domain-task/usecases'
import { TaskCheckItemRepoImpl } from '@nao-todo/infrastructure/backend'
import { getRequesterImpl } from '@nao-todo/shared'

export const useTaskCheckItemUseCase = (store: TaskCheckItemStore) => {
    const requester = getRequesterImpl()
    const taskCheckItemRepo = new TaskCheckItemRepoImpl(requester)
    return new TaskCheckItemUseCase(taskCheckItemRepo, store)
}