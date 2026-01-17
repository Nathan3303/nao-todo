import { BuiltInProjectUseCase } from '@nao-todo/application/usecases/built-in-project'
import { useBuiltInProjectDomain } from '@nao-todo/domain/built-in-project'
import useTasksViewStore from './tasks-view-store'
import useBuiltInProjectRepository from '@nao-todo/infrastructure/built-in/project/repoImpl'

const useTasksView = () => {
    // @store 任务界面状态存储
    const tasksViewStore = useTasksViewStore()

    // @usecase 任务用例
    const builtInProjectUseCase = new BuiltInProjectUseCase(
        useBuiltInProjectDomain(useBuiltInProjectRepository()),
        tasksViewStore
    )

    // @returns
    return {
        builtInProjectUseCase
    }
}

export default useTasksView
