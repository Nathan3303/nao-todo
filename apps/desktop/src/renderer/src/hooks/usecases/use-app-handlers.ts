import { ProjectHandler, useProjectsStore } from '@nao-todo/presentation/project'
import { TagHandler, useTagsStore } from '@nao-todo/presentation/tag'
import { TaskHandler, useTasksStore } from '@nao-todo/presentation/task'
import { useSubscriber } from '@nao-todo/shared'
import { useProjectUseCase } from './use-project-usecase'
import { useTagUseCase } from './use-tag-usecase'
import { useTaskUseCase } from './use-task-usecase'

export type AppHandlers = {
    projectHandler: ProjectHandler
    tagHandler: TagHandler
    taskHandler: TaskHandler
}

/**
 * 应用级 Handler 单例（桌面版）
 * @description 与 web 版同构，但 usecases 全部为桌面本地仓储实现
 *              （IndexedDB 加密存储 + /sync），故此处独立组装而非复用 web 实现。
 */
let appHandlers: AppHandlers | null = null

export const useAppHandlers = (): AppHandlers => {
    if (appHandlers === null) {
        const subscriber = useSubscriber()
        const projectsStore = useProjectsStore()
        const tagsStore = useTagsStore()
        const tasksStore = useTasksStore()
        const projectUseCase = useProjectUseCase(projectsStore)
        const tagUseCase = useTagUseCase(tagsStore)
        const taskUseCase = useTaskUseCase(tasksStore)
        appHandlers = {
            projectHandler: new ProjectHandler(projectUseCase, projectsStore, subscriber),
            tagHandler: new TagHandler(tagUseCase, tagsStore, subscriber),
            taskHandler: new TaskHandler(taskUseCase, subscriber)
        }
    }
    return appHandlers
}