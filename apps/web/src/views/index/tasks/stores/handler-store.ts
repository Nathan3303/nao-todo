import { defineStore } from 'pinia'
import { useTasksViewStore } from '../index'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore, useTagStore, useTodoStore } from '@/stores'
import type {
    CreateProjectOptions,
    CreateTagOptions,
    CreateTodoOptions,
    Project,
    Tag,
    Todo
} from '@nao-todo/types'

export const useTasksHandlerStore = defineStore('TasksHandlerStore', () => {
    const route = useRoute()
    const router = useRouter()
    const projectStore = useProjectStore()
    const tagStore = useTagStore()
    const todoStore = useTodoStore()
    const tasksViewStore = useTasksViewStore()

    // 清单

    // 更新清单标题
    const handleUpdateProjectTitle = async () => {
        const tasksViewStore = useTasksViewStore()
        if (tasksViewStore.category !== 'project') return
        if (!tasksViewStore.viewInfo) return
        await projectStore.updateProjectTitleWithPrompt(
            tasksViewStore.viewInfo.id,
            tasksViewStore.viewInfo.title
        )
    }

    // 更新清单描述
    const handleUpdateProjectDescription = async () => {
        const tasksViewStore = useTasksViewStore()
        if (tasksViewStore.category !== 'project') return
        if (!tasksViewStore.viewInfo) return
        await projectStore.updateProjectDescriptionWithPrompt(
            tasksViewStore.viewInfo.id,
            tasksViewStore.viewInfo.description
        )
    }

    // 更新清单偏好
    const handleUpdateProjectPreference = async () => {
        const tasksViewStore = useTasksViewStore()
        if (tasksViewStore.category !== 'project') return
        if (!tasksViewStore.viewInfo) return
        const projectId = route.params.projectId as Project['id']
        const viewType = (route.name as string).split('-')[2] as string
        const newPreference: Project['preference'] = {
            viewType,
            getTodosOptions: todoStore.getOptions,
            columns: todoStore.columnOptions
        }
        await projectStore.updateProjectPreference(projectId, newPreference)
    }

    // 归档清单
    const handleArchiveProject = async () => {
        const tasksViewStore = useTasksViewStore()
        if (tasksViewStore.category !== 'project') return
        if (!tasksViewStore.viewInfo) return
        const result = await projectStore.archiveProjectWithConfirmation(tasksViewStore.viewInfo.id)
        if (result) await router.push('/tasks/all')
    }

    // 删除清单
    const handleRemoveProject = async () => {
        const tasksViewStore = useTasksViewStore()
        if (tasksViewStore.category !== 'project') return
        if (!tasksViewStore.viewInfo) return
        const result = await projectStore.removeProjectWithConfirmation(tasksViewStore.viewInfo.id)
        if (result) await router.push('/tasks/all')
    }

    // 创建清单
    const handleCreateProject = async (options: CreateProjectOptions) => {
        const result = await projectStore.doCreateProject(options)
        if (!result) return false
        await router.push({
            name: 'tasks-project',
            params: { projectId: result.id }
        })
        return true
    }

    // 标签

    // 重命名标签
    const handleUpdateTagName = async () => {
        const tasksViewStore = useTasksViewStore()
        if (tasksViewStore.category !== 'tag') return
        if (!tasksViewStore.viewInfo) return
        await tagStore.updateTagNameWithPrompt(
            tasksViewStore.viewInfo.id,
            tasksViewStore.viewInfo.title
        )
    }

    // 删除标签
    const handleDeleteTag = async (tagId?: Tag['id']) => {
        const tasksViewStore = useTasksViewStore()
        tagId = tagId || tasksViewStore.viewInfo?.id
        if (!tagId) return false
        const result = await tagStore.deleteTagWithConfirmation(tagId)
        if (result) await router.push('/tasks/all')
        return true
    }

    // 创建标签
    const handleCreateTag = async (options: CreateTagOptions) => {
        const result = (await tagStore.doCreateTag(options)) as Tag
        if (!result) return false
        await router.push({ name: 'tasks-tag', params: { tagId: result.id } })
        return true
    }

    // 选择标签颜色
    const handleSelectTagColor = async (tagId: Tag['id'], color: Tag['color']) => {
        return await tagStore.updateTagColor(tagId, color)
    }

    // 待办

    // 创建待办

    const handleCreateTodo = async (options: CreateTodoOptions) => {
        const result = (await todoStore.doCreateTodo(options)) as Todo
        if (!result) return false
        const isSameProjectId =
            tasksViewStore.category === 'project' &&
            tasksViewStore.viewInfo?.id === options.projectId
        const isContainTagId =
            tasksViewStore.category === 'tag' &&
            options.tags?.includes(tasksViewStore.viewInfo?.id ?? '')
        const isOnBasicView = tasksViewStore.category === 'basic'
        if (isSameProjectId || isContainTagId || isOnBasicView) {
            switch (route.meta.viewType as string) {
                case 'table':
                    await todoStore.doGetTodos()
                    break
                case 'kanban':
                    todoStore.addTodoToLocal(result)
                    break
                default:
                    break
            }
        }
        await router.push({ name: route.name, params: { taskId: result.id } })
        return true
    }

    // 隐藏已完成的待办
    const handleHideTodosWhichIsDone = async () => {
        todoStore.mergeGetOptions({ state: 'todo,in-progress' })
        await todoStore.doGetTodos()
    }

    // 重新获取待办
    const handleRefresh = async () => {
        if (route.meta.viewType === 'kanban') return
        await todoStore.doGetTodos()
    }

    return {
        handleUpdateProjectTitle,
        handleUpdateProjectDescription,
        handleUpdateProjectPreference,
        handleArchiveProject,
        handleRemoveProject,
        handleCreateProject,
        handleUpdateTagName,
        handleDeleteTag,
        handleCreateTag,
        handleSelectTagColor,
        handleCreateTodo,
        handleHideTodosWhichIsDone,
        handleRefresh
    }
})
