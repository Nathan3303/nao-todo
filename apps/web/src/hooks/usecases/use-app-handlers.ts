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
 * 应用级 Handler 单例
 * @description Handlers 需绑定应用级事件总线与全局 store，且可能被多个 feature 根共享；
 *              此处以模块级惰性单例提供（首次调用时组装一次），避免重复实例导致的事件重复订阅。
 *              Web/Electron 均为 CSR，无 SSR 跨请求污染顾虑。
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