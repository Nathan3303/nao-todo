import type { BuiltInProjectUseCase } from '@nao-todo/application/web/usecases/built-in-project'
import type { ProjectUseCase } from '@nao-todo/application/web/usecases/project'
import type { TagUseCase } from '@nao-todo/application/web/usecases/tag'
import useTasksExecutor from '@nao-todo/infrastructure/hooks/use-tasks-executor'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { BuiltInProject, Project, Tag } from '@nao-todo/types'

type BuiltInProjectStore = {
    setLoading: (loading: boolean) => void
    setError: (errStr: string) => void
    setBuiltInProjects: (projects: BuiltInProject[]) => void
}

type ProjectStore = {
    setLoading: (loading: boolean) => void
    setError: (errStr: string) => void
    setProjects: (projects: Project[]) => void
}

type TagStore = {
    setLoading: (loading: boolean) => void
    setError: (errStr: string) => void
    setTags: (tags: Tag[]) => void
}

const useTasksViewInitializeHandler = (
    builtInProjectUseCase: BuiltInProjectUseCase,
    builtInProjectStore: BuiltInProjectStore,
    projectUseCase: ProjectUseCase,
    projectStore: ProjectStore,
    tagUseCase: TagUseCase,
    tagStore: TagStore
) => {
    // @method 加载内建清单任务
    const loadBuiltInProjectsTask = async () => {
        builtInProjectStore.setLoading(true)
        const err = builtInProjectUseCase.loadBuiltInProjects()
        if (err !== null) {
            builtInProjectStore.setError(unwrapError(err))
            builtInProjectStore.setLoading(false)
            return err
        }
        builtInProjectStore.setError('')
        builtInProjectStore.setLoading(false)
        return null
    }

    // @method 加载用户清单任务
    const loadProjectTask = async () => {
        projectStore.setLoading(true)
        const err = await projectUseCase.loadProjects()
        if (err !== null) {
            projectStore.setError(unwrapError(err))
            projectStore.setLoading(false)
            return err
        }
        projectStore.setError('')
        projectStore.setLoading(false)
        return null
    }

    // @method 加载用户标签任务
    const loadTagTask = async () => {
        tagStore.setLoading(true)
        const err = await tagUseCase.loadTags()
        if (err !== null) {
            tagStore.setError(unwrapError(err))
            tagStore.setLoading(false)
            return err
        }
        tagStore.setError('')
        tagStore.setLoading(false)
        return null
    }

    // @return 任务执行器
    return useTasksExecutor([loadBuiltInProjectsTask, loadProjectTask, loadTagTask])
}

export default useTasksViewInitializeHandler
