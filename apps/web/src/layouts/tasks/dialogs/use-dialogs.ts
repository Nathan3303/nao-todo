import type { ProjectCreatorVO } from '@/components/tasks/dialogs/project-creator/types'
import type { DialogCloseFunc, DialogOpenFunc } from '@/infrastructure/hooks/use-dialog-manager'
import { projectCreatorVO2ValueObject } from './converters'
import type {
    CreateTagViewObject,
    CreateTaskViewObject,
    GoAsync,
    ProjectViewObject,
    TagViewObject
} from '@nao-todo/types'
import { storeToRefs } from 'pinia'
import { computed, inject, provide, type ComputedRef } from 'vue'
import { TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { useProjectsStore, useTagsStore } from '@/stores/tasks'
import { DIALOG_MANAGER_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'
import type { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import type { DialogManagerContext } from './types'

export type UseDialogs = {
    availableProjects: ComputedRef<ProjectViewObject[]>
    projects: ComputedRef<ProjectViewObject[]>
    tags: ComputedRef<TagViewObject[]>
    tagColorGetter: (tagId: TagViewObject['id']) => TagViewObject['color']
    projectCreatorRegister: (open: DialogOpenFunc, close: DialogCloseFunc) => void
    projectCreatorHandler: (vo: ProjectCreatorVO) => GoAsync<string>
    projectManagerRegister: (open: DialogOpenFunc, close: DialogCloseFunc) => void
    projectCreatorOpener: () => void
    projectUpdaterRegister: (open: (projectId: string) => void, close: DialogCloseFunc) => void
    projectUpdaterHandler: (
        projectId: ProjectViewObject['id'],
        vo: { name: string; description: string }
    ) => GoAsync<void>
    projectUpdaterOpener: (projectId: ProjectViewObject['id']) => void
    projectGetter: (projectId: ProjectViewObject['id']) => ProjectViewObject | undefined
    tagCreatorRegister: (open: DialogOpenFunc, close: DialogCloseFunc) => void
    tagCreatorHandler: (vo: CreateTagViewObject) => GoAsync<string>
    tagManagerRegister: (open: DialogOpenFunc, close: DialogCloseFunc) => void
    tagCreatorOpener: () => void
    tagColorUpdaterOpener: (tagId: TagViewObject['id']) => void
    tagColorUpdaterRegister: (open: DialogOpenFunc, close: DialogCloseFunc) => void
    tagColorUpdater: (tagId: TagViewObject['id'], color: TagViewObject['color']) => GoAsync<void>
    taskCreatorRegister: (open: DialogOpenFunc, close: DialogCloseFunc) => void
    taskCreatorHandler: (vo: CreateTaskViewObject) => GoAsync<string>
    subscriber: Subscriber
}

const useDialogs = (): UseDialogs => {
    // @context TaskView context
    const tasksViewContext = inject<TasksViewContext>(TASKS_VIEW_CONTEXT_KEY)!

    // @dataStore
    const projectsStore = useProjectsStore()
    const tagsStore = useTagsStore()

    // @presetStates
    const { availableProjects, projects } = storeToRefs(projectsStore)
    const { tags } = storeToRefs(tagsStore)

    // @method 创建清单对话框注册函数
    const projectCreatorRegister = (open: DialogOpenFunc, close: DialogCloseFunc) => {
        tasksViewContext.dialogManager.registerDialog('project-creator', { open, close })
    }

    // @method 创建清单对话框处理函数
    const projectCreatorHandler = async (vo: ProjectCreatorVO): GoAsync<string> => {
        const createVO = projectCreatorVO2ValueObject(vo)
        const [projectVO, err] = await tasksViewContext.projectUseCase.create(createVO)
        if (err !== null) return [null, err]
        return [projectVO.id, null]
    }

    // @method 清单管理对话框注册函数
    const projectManagerRegister = (open: DialogOpenFunc, close: DialogCloseFunc) => {
        tasksViewContext.dialogManager.registerDialog('project-manager', { open, close })
    }

    // @method 清单创建对话框打开函数
    const projectCreatorOpener = () => {
        tasksViewContext.dialogManager.openDialog('project-creator')
    }

    // @method 清单修改对话框注册函数
    const projectUpdaterRegister = (open: (projectId: string) => void, close: DialogCloseFunc) => {
        tasksViewContext.dialogManager.registerDialog('project-updater', { open, close })
    }

    // @method 清单修改对话框处理函数
    const projectUpdaterHandler = async (
        projectId: ProjectViewObject['id'],
        vo: { name: string; description: string }
    ): GoAsync<void> => {
        return await tasksViewContext.projectUseCase.update(projectId, vo)
    }

    // @method 清单修改对话框打开函数
    const projectUpdaterOpener = (projectId: ProjectViewObject['id']) => {
        tasksViewContext.dialogManager.openDialog('project-updater', projectId)
    }

    // @method 清单获取函数
    const projectGetter = (projectId: ProjectViewObject['id']) => {
        return projectsStore.getProject(projectId)
    }

    // @method 标签创建对话框注册函数
    const tagCreatorRegister = (open: DialogOpenFunc, close: DialogCloseFunc) => {
        tasksViewContext.dialogManager.registerDialog('tag-creator', { open, close })
    }

    // @method 创建标签对话框处理函数
    const tagCreatorHandler = async (vo: CreateTagViewObject): GoAsync<string> => {
        const [tagVO, err] = await tasksViewContext.tagUseCase.create(vo)
        if (err !== null) {
            return [null, err]
        }
        return [tagVO.id, null]
    }

    // @method 标签管理对话框注册函数
    const tagManagerRegister = (open: DialogOpenFunc, close: DialogCloseFunc) => {
        tasksViewContext.dialogManager.registerDialog('tag-manager', { open, close })
    }

    // @method 标签颜色更新对话框注册函数
    const tagColorUpdaterRegister = (open: DialogOpenFunc, close: DialogCloseFunc) => {
        tasksViewContext.dialogManager.registerDialog('tag-color-updater', { open, close })
    }

    // @method 标签颜色更新对话框处理函数
    const tagColorUpdater = async (tagId: TagViewObject['id'], color: TagViewObject['color']) => {
        return await tasksViewContext.tagUseCase.update(tagId, { color })
    }

    // @method 标签创建对话框打开函数
    const tagCreatorOpener = () => {
        tasksViewContext.dialogManager.openDialog('tag-creator')
    }

    // @method 标签颜色修改对话框打开函数
    const tagColorUpdaterOpener = (tagId: TagViewObject['id']) => {
        tasksViewContext.dialogManager.openDialog('tag-color-updater', tagId)
    }

    // @method 待办事项创建对话框注册函数
    const taskCreatorRegister = (open: DialogOpenFunc, close: DialogCloseFunc) => {
        tasksViewContext.dialogManager.registerDialog('task-creator', { open, close })
    }

    // @method 待办事项创建对话框处理函数
    const taskCreatorHandler = async (vo: CreateTaskViewObject): GoAsync<string> => {
        const [taskVO, err] = await tasksViewContext.taskUseCase.createTask(vo)
        if (err !== null) return [null, err]
        return [taskVO.id, null]
    }

    // @provide 对话框管理上下文
    provide<DialogManagerContext>(DIALOG_MANAGER_CONTEXT_KEY, {
        projectUseCase: tasksViewContext.projectUseCase,
        tagUseCase: tasksViewContext.tagUseCase
    })

    // @returns
    return {
        projectCreatorRegister,
        projectCreatorHandler,
        availableProjects,
        projects: computed(() => projects.value),
        projectManagerRegister,
        projectCreatorOpener,
        projectUpdaterRegister,
        projectUpdaterHandler,
        projectUpdaterOpener,
        projectGetter,
        tagCreatorRegister,
        tagCreatorHandler,
        tags: computed(() => [...tags.value.values()]),
        tagManagerRegister,
        tagCreatorOpener,
        tagColorUpdaterOpener,
        tagColorUpdaterRegister,
        tagColorGetter: tasksViewContext.getTagColor,
        tagColorUpdater,
        taskCreatorRegister,
        taskCreatorHandler,
        subscriber: tasksViewContext.subscriber
    }
}

export default useDialogs

