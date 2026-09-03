import { TaskCheckItemStore, TaskCheckItemUseCase } from '@nao-todo/domain-task'
import { newLocalTaskCheckItemRepository } from '@nao-todo/infrastructure'

/**
 * 任务检查项用例（桌面版本地仓储）
 */
export const useTaskCheckItemUseCase = (store: TaskCheckItemStore) => {
    const taskCheckItemRepo = newLocalTaskCheckItemRepository()
    return new TaskCheckItemUseCase(taskCheckItemRepo, store)
}