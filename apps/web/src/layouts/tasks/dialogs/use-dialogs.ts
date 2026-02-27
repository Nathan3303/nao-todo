import type { ProjectCreatorVO } from '@/components/tasks/dialogs/project-creator/types'
import type {
    DialogCloseFunc,
    DialogOpenFunc
} from '@/infrastructure/hooks/tasks-view/use-dialog-manager'
import { projectCreatorVO2ValueObject } from './converters'
import type { CreateTag, CreateTask, GoAsync, Project, Tag } from '@nao-todo/types'
import { storeToRefs } from 'pinia'
import { computed, inject, type ComputedRef } from 'vue'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'
import { TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { useProjectsStore, useTagsStore } from '@/stores/tasks'

export type UseDialogs = {
    projects: ComputedRef<Project[]>
    tags: ComputedRef<Tag[]>
    tagColorGetter: (tagId: Tag['id']) => Tag['color']
    projectCreatorRegister: (open: DialogOpenFunc, close: DialogCloseFunc) => void
    projectCreatorHandler: (vo: ProjectCreatorVO) => GoAsync<string>
    projectManagerRegister: (open: DialogOpenFunc, close: DialogCloseFunc) => void
    projectCreatorOpener: () => void
    tagCreatorRegister: (open: DialogOpenFunc, close: DialogCloseFunc) => void
    tagCreatorHandler: (vo: CreateTag) => GoAsync<string>
    tagManagerRegister: (open: DialogOpenFunc, close: DialogCloseFunc) => void
    tagCreatorOpener: () => void
    tagColorUpdaterOpener: (tagId: Tag['id']) => void
    tagColorUpdaterRegister: (open: DialogOpenFunc, close: DialogCloseFunc) => void
    tagColorUpdater: (tagId: Tag['id'], color: Tag['color']) => GoAsync<void>
    taskCreatorRegister: (open: DialogOpenFunc, close: DialogCloseFunc) => void
    taskCreatorHandler: (vo: CreateTask) => GoAsync<string>
}

const useDialogs = (): UseDialogs => {
    // @context TaskView context
    const tasksViewContext = inject<TasksViewContext>(TASKS_VIEW_CONTEXT_KEY)!

    // @dataStore
    const projectsStore = useProjectsStore()
    const tagsStore = useTagsStore()

    // @presetStates
    const { availableProjects: projects } = storeToRefs(projectsStore)
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

    // @method 标签创建对话框注册函数
    const tagCreatorRegister = (open: DialogOpenFunc, close: DialogCloseFunc) => {
        tasksViewContext.dialogManager.registerDialog('tag-creator', { open, close })
    }

    // @method 创建标签对话框处理函数
    const tagCreatorHandler = async (vo: CreateTag): GoAsync<string> => {
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
    const tagColorUpdater = async (tagId: Tag['id'], color: Tag['color']) => {
        return await tasksViewContext.tagUseCase.update(tagId, { color })
    }

    // @method 标签创建对话框打开函数
    const tagCreatorOpener = () => {
        tasksViewContext.dialogManager.openDialog('tag-creator')
    }

    // @method 标签颜色修改对话框打开函数
    const tagColorUpdaterOpener = (tagId: Tag['id']) => {
        tasksViewContext.dialogManager.openDialog('tag-color-updater', tagId)
    }

    // @method 待办事项创建对话框注册函数
    const taskCreatorRegister = (open: DialogOpenFunc, close: DialogCloseFunc) => {
        tasksViewContext.dialogManager.registerDialog('task-creator', { open, close })
    }

    // @method 待办事项创建对话框处理函数
    const taskCreatorHandler = async (vo: CreateTask): GoAsync<string> => {
        const [taskVO, err] = await tasksViewContext.taskUseCase.createTask(vo)
        if (err !== null) return [null, err]
        return [taskVO.id, null]
    }

    // @returns
    return {
        projectCreatorRegister,
        projectCreatorHandler,
        projects: computed(() => [...projects.value.values()]),
        projectManagerRegister,
        projectCreatorOpener,
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
        taskCreatorHandler
    }
}

export default useDialogs
