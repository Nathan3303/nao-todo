import { TaskDomain, TaskStore, TaskUseCase } from '@nao-todo/domain-task'
import { useCaseBinding } from '@/hooks/usecases/binding'

export const useTaskUseCase = (store: TaskStore) => {
    const taskRepo = useCaseBinding.createTaskRepository()
    const taskDomain = new TaskDomain(taskRepo)
    const useCase = new TaskUseCase(taskDomain, taskRepo, store)
    // 阶段二 2A / W1：任务域已切本地优先 ⇒ web binding 对该域**不再套**离线只读闸门（ADR §5 M4「撤该域闸门」）
    // P3（ADR 2026-09-24-project-archive §15.3）：两端 binding 的 `decorateUseCase` 对任务域注入
    // **归档态只读守卫**（web 叠加在离线闸门之后；desktop 仅归档守卫）⇒ 归档任务写被拒 + 可见提示
    return useCaseBinding.decorateUseCase?.(useCase, 'task') ?? useCase
}