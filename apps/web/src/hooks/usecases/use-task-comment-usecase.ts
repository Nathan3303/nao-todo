import { TaskCommentStore, TaskCommentUseCase } from '@nao-todo/domain-task'
import { useCaseBinding } from '@/hooks/usecases/binding'

export const useTaskCommentUseCase = (store: TaskCommentStore) => {
    const taskCommentRepo = useCaseBinding.createTaskCommentRepository()
    const useCase = new TaskCommentUseCase(taskCommentRepo, store)
    // C-59 / AC10：web 离线只读闸门经 binding 注入（web-only）
    return useCaseBinding.decorateUseCase?.(useCase, 'task-comment') ?? useCase
}