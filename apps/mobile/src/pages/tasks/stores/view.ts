import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from '@/pages/auth/store'
import { useTodoStore } from './todo'
import { useProjectStore } from './project'
import { useTagStore } from './tag'
import type {
    Project,
    Tag,
    TasksMainBasicViewNames,
    TasksMainRouteCategory,
    TasksMainViewInfo,
    Todo
} from '@nao-todo/types'
import { basicViewsInfo, defaultPreference } from '../constants'

export const useTasksViewStore = defineStore('TasksViewStore', () => {
    const authStore = useAuthStore()
    const projectStore = useProjectStore()
    const tagStore = useTagStore()
    const todoStore = useTodoStore()

    // 当前视图信息
    const loading = ref(false)
    const category = ref<TasksMainRouteCategory>('basic')
    const viewId = ref<TasksMainBasicViewNames | string>('all')
    const viewInfo = ref<TasksMainViewInfo | null>(null)
    let viewLoadedTag = ''

    // 待办详情面板
    const todoDetailsId = ref<Todo['id'] | null>(null)
    const todoDetailsVisible = ref(false)

    // 获取基础视图信息
    const getBasicViewInfo = () => {
        let _viewInfo = null
        const basicInfo = basicViewsInfo[viewId.value as TasksMainBasicViewNames]
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
                    projectId: authStore.user?.id
                },
                handlers: basicInfo.handlers
            } as TasksMainViewInfo
            if (basicInfo.id === 'inbox') {
                _viewInfo.preference.getTodosOptions.projectId = authStore.user?.id
            }
        }
        viewInfo.value = _viewInfo
    }

    // 获取清单视图信息
    const getProjectViewInfo = () => {
        let _viewInfo = null
        const project = projectStore.getProjectByIdFromLocal(viewId.value as Project['id'])
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
                    updateTitle: () => {},
                    updateDescription: () => {},
                    remove: () => {}
                }
            } as TasksMainViewInfo
        }
        viewInfo.value = _viewInfo
    }

    // 获取标签视图信息
    const getTagViewInfo = () => {
        let _viewInfo = null
        const tag = tagStore.getTagByIdFromLocal(viewId.value as Tag['id'])
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
                    projectId: authStore.user?.id,
                    dueDate: {},
                    tags: [tag.id]
                },
                handlers: {
                    updateTitle: () => {},
                    remove: () => {}
                },
                payload: { color: tag.color }
            } as TasksMainViewInfo
        }
        viewInfo.value = _viewInfo
    }

    // 获取页面信息
    const getViewInfo = async () => {
        switch (category.value) {
            case 'basic':
                if (viewLoadedTag === viewId.value) return
                viewLoadedTag = viewId.value as string
                getBasicViewInfo()
                break
            case 'project':
                if (viewLoadedTag === (viewId.value as Project['id'])) return
                viewLoadedTag = viewId.value as Project['id']
                getProjectViewInfo()
                break
            case 'tag':
                if (viewLoadedTag === (viewId.value as Tag['id'])) return
                viewLoadedTag = viewId.value as Tag['id']
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
                    createTodoOptions: { dueDate: {}, projectId: authStore.user?.id },
                    handlers: basicViewsInfo['all'].handlers
                }
                break
        }
        // if (!viewInfo.value) {
        //     await router.replace('/tasks/all')
        //     return
        // }
        // console.log('[UseTasksViewStore/getViewInfo] category:', category.value)
        // console.log('[UseTasksViewStore/getViewInfo] viewInfo:', viewInfo.value)
        todoStore.setGetOptionsByPreference(viewInfo.value!.preference)
        // baseRouteName.value = 'tasks-' + meta.id + '-' + viewInfo.value!.preference.viewType
        // await router.push({ name: baseRouteName.value, params })
        // document.title = viewInfo.value?.title ? 'NaoTodo - ' + viewInfo.value?.title : 'NaoTodo'
    }

    // 响应页面切换
    const launchTasksView = async (_category: TasksMainRouteCategory, _viewId: string) => {
        // console.log(category, viewId)
        category.value = _category
        viewId.value = _viewId
        await getViewInfo()
        loading.value = true
        await todoStore.getTodos()
        loading.value = false
    }

    // 展开待办详情面板
    const showTodoDetails = (todoId: Todo['id']) => {
        todoDetailsId.value = todoId
        todoDetailsVisible.value = true
    }

    return {
        loading,
        category,
        viewId,
        viewInfo,
        todoDetailsId,
        todoDetailsVisible,
        getViewInfo,
        launchTasksView,
        showTodoDetails
    }
})
