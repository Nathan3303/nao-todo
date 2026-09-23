import { TaskDomain, TaskStore, TaskUseCase } from '@nao-todo/domain-task'
import { useCaseBinding } from '@/hooks/usecases/binding'

export const useTaskUseCase = (store: TaskStore) => {
    const taskRepo = useCaseBinding.createTaskRepository()
    const taskDomain = new TaskDomain(taskRepo)
    const useCase = new TaskUseCase(taskDomain, taskRepo, store)
    // C-59 / AC10：web 离线只读闸门经 binding 注入（**web-only**；desktop 不提供该钩子 ⇒ 写路径不变）
    return useCaseBinding.decorateUseCase?.(useCase, 'task') ?? useCase
}