import { TaskCheckItemStore, TaskCheckItemUseCase } from '@nao-todo/domain-task'
import { useCaseBinding } from '@/hooks/usecases/binding'

export const useTaskCheckItemUseCase = (store: TaskCheckItemStore) => {
    const taskCheckItemRepo = useCaseBinding.createTaskCheckItemRepository()
    const useCase = new TaskCheckItemUseCase(taskCheckItemRepo, store)
    // C-59 / AC10：web 离线只读闸门经 binding 注入（web-only）
    return useCaseBinding.decorateUseCase?.(useCase, 'task-check-item') ?? useCase
}