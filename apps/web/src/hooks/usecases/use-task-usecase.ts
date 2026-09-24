import { TaskDomain, TaskStore, TaskUseCase } from '@nao-todo/domain-task'
import { useCaseBinding } from '@/hooks/usecases/binding'

export const useTaskUseCase = (store: TaskStore) => {
    const taskRepo = useCaseBinding.createTaskRepository()
    const taskDomain = new TaskDomain(taskRepo)
    const useCase = new TaskUseCase(taskDomain, taskRepo, store)
    // 阶段二 2A / W1：任务域已切本地优先 ⇒ web binding 对该域**不再套**离线只读闸门（ADR §5 M4「撤该域闸门」）
    // （钩子仍保留给未切换的域；desktop binding 不提供该钩子 ⇒ 写路径不变）
    return useCaseBinding.decorateUseCase?.(useCase, 'task') ?? useCase
}