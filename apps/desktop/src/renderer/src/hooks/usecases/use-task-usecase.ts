import { TaskDomain, TaskStore, TaskUseCase } from '@nao-todo/domain-task'
import { newLocalTaskRepository } from '@nao-todo/infrastructure'

/**
 * 任务用例（桌面版本地仓储）
 */
export const useTaskUseCase = (store: TaskStore) => {
    const taskRepo = newLocalTaskRepository()
    const taskDomain = new TaskDomain(taskRepo)
    return new TaskUseCase(taskDomain, taskRepo, store)
}