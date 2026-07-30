import { TaskCheckItemStore, TaskCheckItemUseCase } from '@nao-todo/domain-task'
import { TaskCheckItemRepoImpl } from '@nao-todo/infrastructure'
import { getRequesterImpl } from '@nao-todo/shared'

export const useTaskCheckItemUseCase = (store: TaskCheckItemStore) => {
    const requester = getRequesterImpl()
    const taskCheckItemRepo = new TaskCheckItemRepoImpl(requester)
    return new TaskCheckItemUseCase(taskCheckItemRepo, store)
}