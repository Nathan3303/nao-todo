import { TaskCommentStore, TaskCommentUseCase } from '@nao-todo/domain-task'
import { useCaseBinding } from '@/hooks/usecases/binding'

export const useTaskCommentUseCase = (store: TaskCommentStore) => {
    const taskCommentRepo = useCaseBinding.createTaskCommentRepository()
    return new TaskCommentUseCase(taskCommentRepo, store)
}