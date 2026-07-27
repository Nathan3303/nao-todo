import type { TaskCommentStore } from '@nao-todo/application/task/viewobjects'
import { TaskCommentUseCase } from '@nao-todo/application/task/usecases'
import { TaskCommentRepoImpl } from '@nao-todo/infrastructure/backend'
import { getRequesterImpl } from '@nao-todo/shared'

export const useTaskCommentUseCase = (store: TaskCommentStore) => {
    const requester = getRequesterImpl()
    const taskCommentRepo = new TaskCommentRepoImpl(requester)
    return new TaskCommentUseCase(taskCommentRepo, store)
}