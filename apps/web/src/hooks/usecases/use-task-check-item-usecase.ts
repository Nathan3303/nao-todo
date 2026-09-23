import { TaskCheckItemStore, TaskCheckItemUseCase } from '@nao-todo/domain-task'
import { useCaseBinding } from '@/hooks/usecases/binding'

export const useTaskCheckItemUseCase = (store: TaskCheckItemStore) => {
    const taskCheckItemRepo = useCaseBinding.createTaskCheckItemRepository()
    return new TaskCheckItemUseCase(taskCheckItemRepo, store)
}