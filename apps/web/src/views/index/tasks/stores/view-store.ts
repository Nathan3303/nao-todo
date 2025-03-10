import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { basicViewsInfo, defaultPreference } from '../constants'
import { useProjectStore, useTagStore, useTodoStore, useUserStore } from '@/stores'
import { useTasksHandlerStore } from './handler-store'
import type {
    Project,
    Tag,
    TasksMainRouteCategory,
    TasksMainViewInfo,
    TasksMultiSelectInfo
} from '@nao-todo/types'

export const useTasksViewStore = defineStore('TasksViewStore', () => {
    const route = useRoute()
    const router = useRouter()
    const projectStore = useProjectStore()
    const tagStore = useTagStore()
    const todoStore = useTodoStore()
    const userStore = useUserStore()
    const tasksHandlerStore = useTasksHandlerStore()

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

    // 获取基础视图信息
    const getBasicViewInfo = () => {
        let _viewInfo = null
        const basicInfo = basicViewsInfo[route.meta.id as keyof typeof basicViewsInfo]
        if (basicInfo) {
            _viewInfo = {
                id: basicInfo.id,
                title: basicInfo.title,
                description: basicInfo.description,
                preference: {
                    viewType: defaultPreference.viewType,
                    getTodosOptions: {
                        ...defaultPreference.getTodosOptions,
                        ...(basicInfo.preference.getTodosOptions || {})
                    },
                    columns: basicInfo.preference.columns
                },
                createTodoOptions: {
                    ...basicInfo.createTodoOptions,
                    projectId: userStore.user?.id
                },
                handlers: basicInfo.handlers
            } as TasksMainViewInfo
            if (basicInfo.id === 'inbox') {
                _viewInfo.preference.getTodosOptions.projectId = userStore.user?.id
            }
        }
        viewInfo.value = _viewInfo
    }

    // 获取清单视图信息
    const getProjectViewInfo = () => {
        let _viewInfo = null
        const project = projectStore.getProjectByIdFromLocal(
            route.params.projectId as Project['id']
        )
        if (project) {
            _viewInfo = {
                id: project.id,
                title: project.title,
                description: project.description,
                preference: {
                    viewType: project.preference?.viewType || defaultPreference.viewType,
                    getTodosOptions: {
                        ...defaultPreference.getTodosOptions,
                        ...(project.preference?.getTodosOptions || {}),
                        projectId: project.id
                    },
                    columns: {
                        ...defaultPreference.columns,
                        ...(project.preference?.columns || {})
                    }
                },
                createTodoOptions: { dueDate: {}, projectId: project.id },
                handlers: {
                    updateTitle: tasksHandlerStore.handleUpdateProjectTitle,
                    updateDescription: tasksHandlerStore.handleUpdateProjectDescription,
                    remove: tasksHandlerStore.handleRemoveProject
                }
            } as TasksMainViewInfo
        }
        viewInfo.value = _viewInfo
    }

    // 获取标签视图信息
    const getTagViewInfo = () => {
        let _viewInfo = null
        const tag = tagStore.getTagByIdFromLocal(route.params.tagId as Tag['id'])
        if (tag) {
            _viewInfo = {
                id: tag.id,
                title: tag.name,
                description: tag.description,
                preference: {
                    viewType: defaultPreference.viewType,
                    getTodosOptions: {
                        ...defaultPreference.getTodosOptions,
                        tagId: tag.id,
                        isDeleted: false
                    },
                    columns: defaultPreference.columns
                },
                createTodoOptions: {
                    projectId: userStore.user?.id,
                    dueDate: {},
                    tags: [tag.id]
                },
                handlers: {
                    updateTitle: tasksHandlerStore.handleUpdateTagName,
                    remove: tasksHandlerStore.handleDeleteTag
                },
                payload: { color: tag.color }
            } as TasksMainViewInfo
        }
        viewInfo.value = _viewInfo
    }

    // 获取页面信息
    const getViewInfo = async () => {
        const { meta, params } = route
        category.value = meta.category as TasksMainRouteCategory
        switch (meta.category) {
            case 'basic':
                if (viewLoadedTag === meta.id) return
                viewLoadedTag = meta.id as string
                getBasicViewInfo()
                break
            case 'project':
                if (viewLoadedTag === (params.projectId as Project['id'])) return
                viewLoadedTag = params.projectId as Project['id']
                getProjectViewInfo()
                break
            case 'tag':
                if (viewLoadedTag === (params.tagId as Tag['id'])) return
                viewLoadedTag = params.tagId as Tag['id']
                getTagViewInfo()
                break
            default:
                category.value = 'basic'
                viewInfo.value = {
                    id: basicViewsInfo['all'].id,
                    title: basicViewsInfo['all'].title,
                    description: basicViewsInfo['all'].description,
                    preference: {
                        viewType: defaultPreference.viewType,
                        getTodosOptions: {
                            ...defaultPreference.getTodosOptions,
                            ...(basicViewsInfo['all'].preference.getTodosOptions || {})
                        },
                        columns: basicViewsInfo['all'].preference.columns
                    },
                    createTodoOptions: { dueDate: {}, projectId: userStore.user?.id },
                    handlers: basicViewsInfo['all'].handlers
                }
                break
        }
        if (!viewInfo.value) {
            await router.replace('/tasks/all')
            return
        }
        // console.log('[UseTasksViewStore/getViewInfo] category:', category.value)
        // console.log('[UseTasksViewStore/getViewInfo] viewInfo:', viewInfo.value)
        todoStore.setGetOptionsByPreference(viewInfo.value!.preference)
        baseRouteName.value = 'tasks-' + meta.id + '-' + viewInfo.value!.preference.viewType
        await router.push({ name: baseRouteName.value, params })
        document.title = viewInfo.value?.title ? 'NaoTodo - ' + viewInfo.value?.title : 'NaoTodo'
    }

    // 监听 ProjectStore 更新 -> 更新视图信息
    projectStore.$onAction(({ name, after }) => {
        if (['updateProjectTitleWithPrompt', 'updateProjectDescriptionWithPrompt'].includes(name)) {
            after(() => {
                if (category.value === 'project') getProjectViewInfo()
            })
        }
    })

    // 监听 TagStore 更新 -> 更新视图信息
    tagStore.$onAction(({ name, after }) => {
        if (['updateTagNameWithPrompt', 'updateTagColor'].includes(name)) {
            after(() => {
                if (category.value === 'tag') getTagViewInfo()
            })
        }
    })

    return {
        category,
        viewInfo,
        baseRouteName,
        multiSelectStates,
        showMultiDetails,
        hideMultiDetails,
        getViewInfo
    }
})
