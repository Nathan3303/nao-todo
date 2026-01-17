import type { ProjectCreatorVO } from '@/components/tasks/dialogs/project-creator/types'
import type {
    DialogCloseFunc,
    DialogOpenFunc
} from '@/infrastructure/hooks/tasks-view/use-dialog-manager'
import { useTasksViewStore } from '@/views/tasks'
import { projectCreatorVO2ValueObject } from './converters'
import type { CreateTagVO, CreateTaskVO, GoAsync, TagVO } from '@nao-todo/types'
import { computed } from 'vue'

const useDialogs = () => {
    // @store
    const tasksViewStore = useTasksViewStore()

    // @method 创建清单对话框注册函数
    const projectCreatorRegister = (open: DialogOpenFunc, close: DialogCloseFunc) => {
        tasksViewStore.dialogManager.registerDialog('project-creator', { open, close })
    }

    // @method 创建清单对话框处理函数
    const projectCreatorHandler = async (vo: ProjectCreatorVO): GoAsync<string> => {
        const createVO = projectCreatorVO2ValueObject(vo)
        const [projectVO, err] = await tasksViewStore.projectApp.create(createVO)
        if (err !== null) return [null, err]
        return [projectVO.id, null]
    }

    // @computed 清单列表
    const projects = computed(() => {
        return tasksViewStore.projectApp.states.projects
    })

    // @method 清单管理对话框注册函数
    const projectManagerRegister = (open: DialogOpenFunc, close: DialogCloseFunc) => {
        tasksViewStore.dialogManager.registerDialog('project-manager', { open, close })
    }

    // @method 标签创建对话框注册函数
    const tagCreatorRegister = (open: DialogOpenFunc, close: DialogCloseFunc) => {
        tasksViewStore.dialogManager.registerDialog('tag-creator', { open, close })
    }

    // @method 创建标签对话框处理函数
    const tagCreatorHandler = async (vo: CreateTagVO): GoAsync<string> => {
        const [tagVO, err] = await tasksViewStore.tagApp.create(vo)
        if (err !== null) {
            return [null, err]
        }
        return [tagVO.id, null]
    }

    // @computed 标签列表
    const tags = computed(() => {
        return tasksViewStore.tagApp.states.tags
    })

    // @method 标签管理对话框注册函数
    const tagManagerRegister = (open: DialogOpenFunc, close: DialogCloseFunc) => {
        tasksViewStore.dialogManager.registerDialog('tag-manager', { open, close })
    }

    // @method 标签颜色更新对话框注册函数
    const tagColorUpdaterRegister = (open: DialogOpenFunc, close: DialogCloseFunc) => {
        tasksViewStore.dialogManager.registerDialog('tag-color-updater', { open, close })
    }

    // @method 标签颜色更新对话框处理函数
    const tagColorUpdater = async (tagId: TagVO['id'], color: TagVO['color']) => {
        return tasksViewStore.tagApp.update(tagId, { color })
    }

    // @method 待办事项创建对话框注册函数
    const taskCreatorRegister = (open: DialogOpenFunc, close: DialogCloseFunc) => {
        tasksViewStore.dialogManager.registerDialog('task-creator', { open, close })
    }

    // @method 待办事项创建对话框处理函数
    const taskCreatorHandler = async (vo: CreateTaskVO): GoAsync<string> => {
        const [taskVO, err] = await tasksViewStore.taskApp.create(vo)
        if (err !== null) return [null, err]
        return [taskVO.id, null]
    }

    // @returns
    return {
        projectCreatorRegister,
        projectCreatorHandler,
        projects,
        projectManagerRegister,
        tagCreatorRegister,
        tagCreatorHandler,
        tags,
        tagManagerRegister,
        tagColorUpdaterRegister,
        tagColorGetter: tasksViewStore.getTagColor,
        tagColorUpdater,
        taskCreatorRegister,
        taskCreatorHandler
    }
}

export default useDialogs
