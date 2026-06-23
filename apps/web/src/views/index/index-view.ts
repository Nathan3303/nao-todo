import type { AppContext } from '@/app'
import { APP_CONTEXT_KEY, INDEX_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import useResponsiveAside from '@/infrastructure/hooks/use-responsive-aside'
import { useDialogManager, type DialogManager } from '@/infrastructure/hooks/use-dialog-manager'
import { useThemeStore, useUserStore, type ThemeMode } from '@/stores'
import { useProjectsStore, useTagsStore, useTasksStore } from '@/stores'
import { UserUseCase } from '@nao-todo/application/web/usecases/user'
import { ProjectUseCase } from '@nao-todo/application/web/usecases/project'
import { TagUseCase } from '@nao-todo/application/web/usecases/tag'
import { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import useSubscriber, { type Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import { responsiveTypes } from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import { inject, provide, ref, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
    PROJECT_CREATOR_DIALOG_KEY,
    TASK_CREATOR_DIALOG_KEY,
    TASK_REMINDER_DIALOG_KEY
} from '@/infrastructure/constants/dialog-keys'
import type {
    ProjectViewObject,
    SSEReminderEvent,
    TagViewObject,
    TaskViewObject
} from '@nao-todo/types'
import { LAST_VISITED_ROUTE_KEY } from '@/router'
import useScope from '@/infrastructure/hooks/use-scope'
import useShortcut from '@/infrastructure/hooks/use-shortcut'

/**
 * 首页视图上下文
 * @description 包含首页视图的所有上下文数据，包括应用上下文、用户使用案例、对话框管理器、
 *              项目使用案例、标签使用案例、任务使用案例、事件订阅器、边栏响应式状态等。
 */
export type IndexViewContext = {
    appContext: AppContext
    userUseCase: UserUseCase
    dialogManager: DialogManager
    projectUseCase: ProjectUseCase
    tagUseCase: TagUseCase
    taskUseCase: TaskUseCase
    subscriber: Subscriber
    isDisplayAside: Ref<boolean>
    isUseFloatAside: Ref<boolean>
    switchDisplayAside: () => void
    isDisplayOutline: Ref<boolean>
    isUseFloatOutline: Ref<boolean>
    showTaskDetails: (taskId: TaskViewObject['id']) => void
    getProjectName: (projectId: ProjectViewObject['id']) => ProjectViewObject['name']
    getTagColor: (tagId: TagViewObject['id']) => TagViewObject['color']
}

/**
 * 首页视图
 * @description 提供首页视图的所有上下文数据和方法，包括应用上下文、用户使用案例、对话框管理器、
 *              项目使用案例、标签使用案例、任务使用案例、事件订阅器、边栏响应式状态等。
 * @returns 首页视图上下文
 */
const useIndexView = () => {
    /**
     * 应用上下文
     */
    const appContext = inject<AppContext>(APP_CONTEXT_KEY)!

    /**
     * 路由实例
     * @description 用于导航到其他路由。
     */
    const route = useRoute()
    const router = useRouter()

    /**
     * 内存存储
     * @description 用于存储用户配置、主题模式、项目列表、标签列表、任务列表等内存数据。
     */
    const userStore = useUserStore()
    const themeStore = useThemeStore()
    const projectsStore = useProjectsStore()
    const tagsStore = useTagsStore()
    const tasksStore = useTasksStore()

    /**
     * 用例
     */
    const userUseCase = UserUseCase.create(userStore)
    const projectUseCase = ProjectUseCase.create(projectsStore)
    const tagUseCase = TagUseCase.create(tagsStore)
    const taskUseCase = TaskUseCase.create(tasksStore)

    /**
     * 对话框管理器
     */
    const dialogManager = useDialogManager()

    /**
     * 事件订阅器
     * @use 用于订阅事件，例如用户点击按钮、滚动页面等。
     */
    const subscriber = useSubscriber()

    /**
     * 快捷键管理器
     * @use n 创建任务
     * @use p 创建项目
     */
    useScope('index-view')
    useShortcut('task.create', 'n', () => dialogManager.open(TASK_CREATOR_DIALOG_KEY))
    useShortcut('project.create', 'p', () => dialogManager.open(PROJECT_CREATOR_DIALOG_KEY))

    /**
     * 边栏响应式状态
     */
    const {
        visible: isDisplayAside,
        isFloating: isUseFloatAside,
        switchVisible: switchDisplayAside
    } = useResponsiveAside(appContext.responsiveFlag, responsiveTypes.MOBILE)
    const { visible: isDisplayOutline, isFloating: isUseFloatOutline } = useResponsiveAside(
        appContext.responsiveFlag,
        responsiveTypes.MOBILE_TABLE
    )

    /**
     * 从用户配置加载主题模式并应用到主题存储
     */
    const loadUserThemeModeFromConfig = () => {
        themeStore.updateTheme(userStore.config?.appearance as ThemeMode | 'system')
    }

    /**
     * 显示任务详情抽屉
     * @param taskId 任务 ID
     */
    const showTaskDetails = (taskId: TaskViewObject['id']) => {
        router.push({ name: router.currentRoute.value.name, params: { taskId } })
    }

    /**
     * 获取项目名称
     * @param projectId 项目 ID
     * @returns 项目名称
     */
    const getProjectName = (projectId: ProjectViewObject['id']) => {
        return projectsStore.projects.find((p) => p.id === projectId)?.name || ''
    }

    /**
     * 获取标签颜色
     * @param tagId 标签 ID
     * @returns 标签颜色
     */
    const getTagColor = (tagId: TagViewObject['id']) => {
        return tagsStore.getTag(tagId)?.color || 'transparent'
    }

    /**
     * SSE 提醒连接
     */
    const connectReminderSSE = () => {
        // 请求通知权限
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission()
        }
        // 连接 SSE 事件源
        const token = localStorage.getItem('USER_JWT')
        const url = `${import.meta.env.VITE_API_BASE_URL}/sse/reminders?token=${token}`
        const es = new EventSource(url)
        // 监听提醒事件
        es.addEventListener('reminder', (event: MessageEvent) => {
            const data = JSON.parse(event.data) as SSEReminderEvent
            dialogManager.open(TASK_REMINDER_DIALOG_KEY, data)
            // 显示通知
            if ('Notification' in window && Notification.permission === 'granted') {
                const notification = new Notification(data.taskName, {
                    body: data.description || '',
                    icon: '/favicon.ico'
                })
                notification.onclick = () => {
                    window.focus()
                    notification.close()
                }
            }
        })
        // 监听错误事件，关闭连接
        es.addEventListener('error', () => es.close())
    }

    /**
     * 首页视图加载状态
     */
    const isLoading = ref(true)

    /**
     * 首页视图依赖数据初始化
     */
    const IndexViewInitialize = () => {
        // 初始化用户配置、主题模式、项目列表、标签列表、任务列表
        Promise.all([
            userUseCase.loadUserProfile(),
            userUseCase.loadUserConfig(),
            loadUserThemeModeFromConfig(),
            connectReminderSSE()
        ])
            .then(() => {
                if (route.name !== 'index') return
                const lastRoute = localStorage.getItem(LAST_VISITED_ROUTE_KEY)
                router.replace(lastRoute || '/tasks')
            })
            .finally(() => {
                isLoading.value = false
            })
    }

    /**
     * 提供首页视图上下文
     */
    provide<IndexViewContext>(INDEX_VIEW_CONTEXT_KEY, {
        appContext,
        userUseCase,
        dialogManager,
        projectUseCase,
        tagUseCase,
        taskUseCase,
        subscriber,
        isDisplayAside,
        isUseFloatAside,
        switchDisplayAside,
        isDisplayOutline,
        isUseFloatOutline,
        showTaskDetails,
        getProjectName,
        getTagColor
    })

    // @return
    return { isLoading, IndexViewInitialize }
}

export default useIndexView


