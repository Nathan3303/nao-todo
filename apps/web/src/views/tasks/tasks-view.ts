import { BuiltInProjectUseCase } from '@nao-todo/application/web/usecases/built-in-project'
import { useBuiltInProjectDomain } from '@nao-todo/domain/built-in-project'
import useBuiltInProjectRepository from '@nao-todo/infrastructure/built-in/project/repoImpl'
import useBuiltInProjectStore from '@nao-todo/application/web/stores/built-in-project-store'
import useTaskStore from '@nao-todo/application/web/stores/task-store'
import { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import { TaskDomain } from '@nao-todo/domain/task'
import { useTaskRepository } from '@nao-todo/infrastructure/backend/task/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'

const useTasksView = () => {
    // @stores
    const builtInProjectStore = useBuiltInProjectStore()
    const taskStore = useTaskStore()

    // @usecase 内建清单用例
    const builtInProjectUseCase = new BuiltInProjectUseCase(
        useBuiltInProjectDomain(useBuiltInProjectRepository()),
        builtInProjectStore
    )

    // @usecase 任务用例
    const taskUseCase = new TaskUseCase(
        new TaskDomain(useTaskRepository(getRequesterImpl())),
        taskStore
    )

    // @returns
    return {
        builtInProjectStore,
        taskStore,
        builtInProjectUseCase,
        taskUseCase
    }
}

export default useTasksView
