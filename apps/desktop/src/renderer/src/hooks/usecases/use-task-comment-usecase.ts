import { TaskCommentStore, TaskCommentUseCase } from '@nao-todo/domain-task'
import { newLocalTaskCommentRepository } from '@nao-todo/infrastructure'

/**
 * 任务评论用例（桌面版本地仓储）
 */
export const useTaskCommentUseCase = (store: TaskCommentStore) => {
    const taskCommentRepo = newLocalTaskCommentRepository()
    return new TaskCommentUseCase(taskCommentRepo, store)
}