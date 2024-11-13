import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { basicViewsInfo } from './constants'
import { useProjectStore } from '@/stores'
import type {
    Project,
    TasksMainRouteCategory,
    TasksMainViewInfo,
    TasksMultiSelectInfo
} from '@nao-todo/types'

export const useTasksViewStore = defineStore('tasksMainViewStore', () => {
    const route = useRoute()
    const router = useRouter()
    const projectStore = useProjectStore()

    // 当前视图信息
    const category = ref<TasksMainRouteCategory>('basic')
    const baseRouteName = ref<string>('')
    const viewInfo = ref<TasksMainViewInfo | null>(null)
    let viewLoadedTag = ''

    // 多选状态
    const multiSelectStates = ref<TasksMultiSelectInfo>({
        isShowMultiDetails: false,
        selectedTodoIds: []
    })

    // 显示多选详情
    const showMultiDetails = (selectedTodoIds: TasksMultiSelectInfo['selectedTodoIds']) => {
        multiSelectStates.value.isShowMultiDetails = true
        multiSelectStates.value.selectedTodoIds = selectedTodoIds
    }

    // 隐藏多选详情
    const hideMultiDetails = () => {
        multiSelectStates.value.isShowMultiDetails = false
        multiSelectStates.value.selectedTodoIds = []
    }

    // 删除项目
    const handleRemoveProject = async () => {
        if (category.value !== 'project') return
        if (!viewInfo.value) return
        const { id } = viewInfo.value
        const deleteResult = await projectStore.removeProjectWithConfirmation(id)
        if (deleteResult) router.push('/tasks/all')
    }

    // 更新项目标题
    const handleUpdateProjectTitle = () => {
        if (category.value !== 'project') return
        if (!viewInfo.value) return
        const { id, title } = viewInfo.value
        projectStore.updateProjectTitleWithPromt(id, title)
    }

    // 更新项目描述
    const handleUpdateProjectDescription = () => {
        if (category.value !== 'project') return
        if (!viewInfo.value) return
        const { id, description } = viewInfo.value
        projectStore.updateProjectDescriptionWithPromt(id, description)
    }

    // 重命名标签
    // const handleRenameTag = async () => {
    //     if (category.value !== 'tag') return
    //     if (!viewInfo.value) return
    //     const { id, title } = viewInfo.value
    //     return await renameTagWithPrompt(id, title)
    // }

    // 删除标签
    // const handleDeleteTag = async (tagId: string) => {
    //     if (category.value !== 'tag') return
    //     if (!viewInfo.value) return
    //     const { id } = viewInfo.value
    //     const removeResult = await removeTagWithConfirm(id)
    //     if (removeResult._id !== tagId) return
    //     router.push('/tasks/all')
    // }

    // 获取基础视图信息
    const getBasicViewInfo = () => {
        const { meta } = route
        if (viewLoadedTag === meta.id) return
        viewLoadedTag = meta.id as string
        const id = meta.id as keyof typeof basicViewsInfo
        viewInfo.value = basicViewsInfo[id]
        baseRouteName.value = 'tasks-' + meta.id + '-' + viewInfo.value.preference.viewType
        router.push({ name: baseRouteName.value })
    }

    // 获取清单视图信息
    const getProjectViewInfo = () => {
        const { meta, params } = route
        const id = params.projectId as Project['id']
        if (viewLoadedTag === id) return
        viewLoadedTag = id as string
        const project = projectStore.getProjectByIdFromLocal(id) ?? null
        if (!project) return (viewInfo.value = null)
        viewInfo.value = {
            id: project.id,
            title: project.title,
            description: project.description,
            preference: project.preference || { viewType: 'table' },
            createTodoOptions: { projectId: project.id },
            handlers: {
                updateTitle: handleUpdateProjectTitle,
                updateDescription: handleUpdateProjectDescription,
                remove: handleRemoveProject
            }
        }
        baseRouteName.value = 'tasks-' + meta.id + '-' + viewInfo.value.preference.viewType
        router.push({ name: baseRouteName.value })
    }

    // 获取页面信息
    const getViewInfo = async () => {
        const { meta } = route
        category.value = meta.category as TasksMainRouteCategory
        switch (meta.category) {
            case 'basic':
                getBasicViewInfo()
                break
            case 'project':
                getProjectViewInfo()
                break
            case 'tag':
                // TODO
                viewInfo.value = null
                break
            default:
                viewInfo.value = null
                break
        }
        document.title = viewInfo.value?.title ? 'NaoTodo - ' + viewInfo.value.title : 'NaoTodo'
    }

    return {
        category,
        viewInfo,
        baseRouteName,
        multiSelectStates,
        showMultiDetails,
        hideMultiDetails,
        getViewInfo,
        handleRemoveProject
    }
})
