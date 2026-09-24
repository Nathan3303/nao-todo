import { TaskCommentStore, TaskCommentUseCase } from '@nao-todo/domain-task'
import { useCaseBinding } from '@/hooks/usecases/binding'

export const useTaskCommentUseCase = (store: TaskCommentStore) => {
    const taskCommentRepo = useCaseBinding.createTaskCommentRepository()
    const useCase = new TaskCommentUseCase(taskCommentRepo, store)
    // 阶段二 2A / W2：子实体域（评论）已切本地优先 ⇒ web binding 对该域**不再套**离线只读闸门（ADR §5 M5）
    // （钩子仍保留给未切换的域；desktop binding 不提供该钩子 ⇒ 写路径不变）
    return useCaseBinding.decorateUseCase?.(useCase, 'task-comment') ?? useCase
}