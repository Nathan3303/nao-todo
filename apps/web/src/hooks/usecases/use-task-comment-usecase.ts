import { TaskCommentStore, TaskCommentUseCase } from '@nao-todo/domain-task'
import { TaskCommentRepoImpl } from '@nao-todo/infrastructure'
import { getRequesterImpl } from '@nao-todo/shared'

export const useTaskCommentUseCase = (store: TaskCommentStore) => {
    const requester = getRequesterImpl()
    const taskCommentRepo = new TaskCommentRepoImpl(requester)
    return new TaskCommentUseCase(taskCommentRepo, store)
}