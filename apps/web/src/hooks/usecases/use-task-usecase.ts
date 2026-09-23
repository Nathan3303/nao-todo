import { TaskDomain, TaskStore, TaskUseCase } from '@nao-todo/domain-task'
import { useCaseBinding } from '@/hooks/usecases/binding'

export const useTaskUseCase = (store: TaskStore) => {
    const taskRepo = useCaseBinding.createTaskRepository()
    const taskDomain = new TaskDomain(taskRepo)
    return new TaskUseCase(taskDomain, taskRepo, store)
}