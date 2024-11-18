import { onBeforeUnmount, ref } from 'vue'
import { defineStore } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { basicViewsInfo, defaultPreference } from './constants'
import { useProjectStore, useTagStore, useTodoStore, useUserStore } from '@/stores'
import type {
    Project,
    Tag,
    TasksMainRouteCategory,
    TasksMainViewInfo,
    TasksMultiSelectInfo
} from '@nao-todo/types'

export const useTasksViewStore = defineStore('tasksMainViewStore', () => {
    const route = useRoute()
    const router = useRouter()
    const projectStore = useProjectStore()
    const tagStore = useTagStore()
    const todoStore = useTodoStore()
    const userStore = useUserStore()

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

    // 删除清单
    const handleRemoveProject = async () => {
        if (category.value !== 'project') return
        if (!viewInfo.value) return
        const { id } = viewInfo.value
        const deleteResult = await projectStore.removeProjectWithConfirmation(id)
        if (deleteResult) await router.push('/tasks/all')
    }

    // 更新清单标题
    const handleUpdateProjectTitle = async () => {
        if (category.value !== 'project') return
        if (!viewInfo.value) return
        const { id, title } = viewInfo.value
        await projectStore.updateProjectTitleWithPrompt(id, title)
    }

    // 更新清单描述
    const handleUpdateProjectDescription = async () => {
        if (category.value !== 'project') return
        if (!viewInfo.value) return
        const { id, description } = viewInfo.value
        await projectStore.updateProjectDescriptionWithPrompt(id, description)
    }

    // 更新清单偏好
    const handleUpdateProjectPreference = async () => {
        if (category.value !== 'project') return
        if (!viewInfo.value) return
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
        if (category.value !== 'project') return
        if (!viewInfo.value) return
        const projectId = viewInfo.value.id as Project['id']
        const result = await projectStore.archiveProjectWithConfirmation(projectId)
        if (result) await router.push('/tasks/all')
    }

    // 重命名标签
    const handleUpdateTagName = async () => {
        if (category.value !== 'tag') return
        if (!viewInfo.value) return
        const { id, title } = viewInfo.value
        await tagStore.updateTagNameWithPrompt(id, title)
    }

    // 删除标签
    const handleDeleteTag = async () => {
        if (category.value !== 'tag') return
        if (!viewInfo.value) return
        const { id } = viewInfo.value
        const deleteResult = await tagStore.deleteTagWithConfirmation(id)
        if (deleteResult) await router.push('/tasks/all')
    }

    // 获取基础视图信息
    const getBasicViewInfo = async () => {
        const { meta } = route
        const id = meta.id as keyof typeof basicViewsInfo
        const _viewInfo = { ...basicViewsInfo[id] }
        _viewInfo.createTodoOptions.projectId = userStore.user?.id
        _viewInfo.preference.getTodosOptions.projectId = userStore.user?.id
        console.log('[UseTasksViewStore/getBasicViewInfo] _viewInfo:', _viewInfo)
        viewInfo.value = _viewInfo
        todoStore.setGetOptionsByPreference(viewInfo.value.preference)
        baseRouteName.value = 'tasks-' + meta.id + '-' + viewInfo.value.preference.viewType
        await router.push({ name: baseRouteName.value })
    }

    // 获取清单视图信息
    const getProjectViewInfo = async () => {
        const { meta, params } = route
        const projectId = params.projectId as Project['id']
        const project = projectStore.getProjectByIdFromLocal(projectId)
        if (!project) return (viewInfo.value = null)
        // console.log('[UseTasksViewStore/getProjectViewInfo] project:', project)
        const _viewInfo: TasksMainViewInfo = {
            id: project.id,
            title: project.title,
            description: project.description,
            preference: {
                viewType: project.preference.viewType || defaultPreference.viewType,
                getTodosOptions: {
                    ...defaultPreference.getTodosOptions,
                    ...(project.preference.getTodosOptions || {})
                },
                columns: {
                    ...defaultPreference.columns,
                    ...(project.preference.columns || {})
                }
            },
            createTodoOptions: { dueDate: {}, projectId: project.id },
            handlers: {
                updateTitle: handleUpdateProjectTitle,
                updateDescription: handleUpdateProjectDescription,
                remove: handleRemoveProject
            }
        }
        _viewInfo.preference.getTodosOptions.projectId = projectId
        viewInfo.value = _viewInfo
        // console.log('[UseTasksViewStore/getProjectViewInfo] _viewInfo:', _viewInfo)
        todoStore.setGetOptionsByPreference(_viewInfo.preference)
        baseRouteName.value = 'tasks-' + meta.id + '-' + _viewInfo.preference.viewType
        await router.push({ name: baseRouteName.value })
    }

    // 获取标签视图信息
    const getTagViewInfo = async () => {
        const { meta, params } = route
        const id = params.tagId as Tag['id']
        const tag = tagStore.getTagByIdFromLocal(id) ?? null
        if (!tag) return (viewInfo.value = null)
        defaultPreference.getTodosOptions.tagId = id
        defaultPreference.getTodosOptions.isDeleted = false
        viewInfo.value = {
            id: tag.id,
            title: tag.name,
            description: tag.description,
            preference: defaultPreference,
            createTodoOptions: { dueDate: {}, tags: [tag.id] },
            handlers: {
                updateTitle: handleUpdateTagName,
                remove: handleDeleteTag
            }
        }
        // console.log('[UseTasksViewStore] getTagViewInfo:', viewInfo.value.preference)
        todoStore.setGetOptionsByPreference(viewInfo.value.preference)
        baseRouteName.value = 'tasks-' + meta.id + '-' + viewInfo.value.preference.viewType
        await router.push({ name: baseRouteName.value })
    }

    // 获取页面信息
    const getViewInfo = async () => {
        const { meta, params } = route
        category.value = meta.category as TasksMainRouteCategory
        switch (meta.category) {
            case 'basic':
                if (viewLoadedTag === meta.id) return
                viewLoadedTag = meta.id as string
                await getBasicViewInfo()
                break
            case 'project':
                if (viewLoadedTag === (params.projectId as Project['id'])) return
                viewLoadedTag = params.projectId as Project['id']
                await getProjectViewInfo()
                break
            case 'tag':
                if (viewLoadedTag === (params.tagId as Tag['id'])) return
                viewLoadedTag = params.tagId as Tag['id']
                await getTagViewInfo()
                break
            default:
                category.value = 'unknown'
                viewInfo.value = null
                break
        }
        document.title = viewInfo.value?.title ? 'NaoTodo - ' + viewInfo.value?.title : 'NaoTodo'
    }

    // 监听 ProjectStore 更新 -> 更新视图信息
    const unsubscribeProjectStoresAction = projectStore.$onAction(({ name, after }) => {
        if (['updateProjectTitleWithPrompt', 'updateProjectDescriptionWithPrompt'].includes(name)) {
            after(() => {
                const projectId = route.params.projectId as Project['id']
                const project = projectStore.getProjectByIdFromLocal(projectId)
                if (!project || !viewInfo.value) return
                viewInfo.value.title = project.title
                viewInfo.value.description = project.description
            })
        }
    })

    // 监听 TagStore 更新 -> 更新视图信息
    const unsubscribeTagStoresAction = tagStore.$onAction(({ name, after }) => {
        if (['updateTagNameWithPrompt'].includes(name)) {
            after(() => {
                const tagId = route.params.tagId as Tag['id']
                const tag = tagStore.getTagByIdFromLocal(tagId)
                if (!tag || !viewInfo.value) return
                viewInfo.value.title = tag.name
            })
        }
    })

    // 卸载钩子
    onBeforeUnmount(() => {
        unsubscribeProjectStoresAction()
        unsubscribeTagStoresAction()
    })

    return {
        category,
        viewInfo,
        baseRouteName,
        multiSelectStates,
        showMultiDetails,
        hideMultiDetails,
        getViewInfo,
        handleRemoveProject,
        handleUpdateProjectPreference,
        handleArchiveProject
    }
})
