import { useAppAsideV2Controller } from '@/components/app/aside-v2'
import { APP_CONTEXT_KEY } from '@/context'
import {
    useProjectUseCase,
    useScope,
    useShortcut,
    useTagUseCase,
    useTaskUseCase,
    useUserUseCase
} from '@/hooks'
import { LAST_VISITED_ROUTE_KEY } from '@/router'
import type { ThemeMode } from '@nao-todo/application'
import type { ProjectViewObject } from '@nao-todo/application/project/viewobjects'
import type { TagViewObject } from '@nao-todo/application/tag/viewobjects'
import type { TaskViewObject } from '@nao-todo/domain-task/viewobjects'
import { ProjectHandler, useProjectsStore } from '@nao-todo/presentation/project'
import { TagHandler, useTagsStore } from '@nao-todo/presentation/tag'
import { TaskHandler, useTasksStore } from '@nao-todo/presentation/task'
import { useThemeStore, useUserStore } from '@nao-todo/presentation/user'
import {
    PROJECT_CREATOR_DIALOG_KEY,
    responsiveTypes,
    TASK_CREATOR_DIALOG_KEY,
    TASK_REMINDER_DIALOG_KEY,
    useAsideWidth,
    useDialogManager,
    useResponsiveAside,
    useSubscriber
} from '@nao-todo/shared'
import { inject, provide, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { INDEX_VIEW_CONTEXT_KEY } from './context'

/**
 * 首页视图
 * @description 提供首页视图的所有上下文数据和方法，包括应用上下文、用户使用案例、对话框管理器、
 *              项目使用案例、标签使用案例、任务使用案例、事件订阅器、边栏响应式状态等。
 * @returns 首页视图上下文
 */
const useIndexView = () => {
    // @context App 上下文
    const { responsiveFlag } = inject(APP_CONTEXT_KEY)!

    // @router 路由实例
    const route = useRoute()
    const router = useRouter()

    // @stores
    const userStore = useUserStore()
    const themeStore = useThemeStore()
    const projectsStore = useProjectsStore()
    const tagsStore = useTagsStore()
    const tasksStore = useTasksStore()

    // @usecases
    const userUseCase = useUserUseCase(userStore)
    const projectUseCase = useProjectUseCase(projectsStore)
    const tagUseCase = useTagUseCase(tagsStore)
    const taskUseCase = useTaskUseCase(tasksStore)

    // @dialogManager 对话框管理器
    // @subscriber 事件订阅器
    const appDialogManager = useDialogManager()
    const appSubscriber = useSubscriber()

    // @handlers 处理层
    const projectHandler = new ProjectHandler(projectUseCase, projectsStore, appSubscriber)
    const tagHandler = new TagHandler(tagUseCase, tagsStore, appSubscriber)
    const taskHandler = new TaskHandler(taskUseCase, appSubscriber)

    /**
     * 快捷键管理器
     * @use n 创建任务
     * @use p 创建项目
     */
    useScope('index-view')
    useShortcut('task.create', 'n', () => appDialogManager.open(TASK_CREATOR_DIALOG_KEY))
    useShortcut('project.create', 'p', () => appDialogManager.open(PROJECT_CREATOR_DIALOG_KEY))

    /**
     * 边栏响应式状态
     */
    const { isDisplayAside, isUseFloatAside, switchDisplayAside, setControllOption } =
        useAppAsideV2Controller(responsiveFlag)
    const { visible: isDisplayOutline, isFloating: isUseFloatOutline } = useResponsiveAside(
        responsiveFlag,
        responsiveTypes.MOBILE_TABLE
    )
    const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(300, 'ASIDE_WIDTH')

    /**
     * 显示任务详情抽屉
     * @param taskId 任务 ID
     */
    const showTaskDetails = async (taskId: TaskViewObject['id']) => {
        await router.push({ name: router.currentRoute.value.name, params: { taskId } })
    }

    /**
     * 从用户配置加载主题模式并应用到主题存储
     */
    const loadUserThemeModeFromConfig = () => {
        themeStore.updateTheme(userStore.config?.appearance as ThemeMode | 'system')
    }

    /**
     * SSE 提醒连接
     */
    const connectReminderSSE = async () => {
        // 请求通知权限
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission()
        }
        // 连接 SSE 事件源
        const token = localStorage.getItem('USER_JWT')
        const url = `${import.meta.env.VITE_API_BASE_URL}/sse/reminders?token=${token}`
        const es = new EventSource(url)
        // 监听提醒事件
        es.addEventListener('reminder', (event: MessageEvent) => {
            const data = JSON.parse(event.data)
            appDialogManager.open(TASK_REMINDER_DIALOG_KEY, data)
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
    const IndexViewInitialize = async () => {
        // 初始化用户配置、主题模式、项目列表、标签列表、任务列表
        loadUserThemeModeFromConfig()
        await Promise.all([
            userUseCase.loadUserProfile(),
            userUseCase.loadUserConfig(),
            connectReminderSSE()
        ])
            .then(() => {
                if (route.name !== 'index') return
                const lastRoute = localStorage.getItem(LAST_VISITED_ROUTE_KEY)
                return router.replace(lastRoute || '/tasks')
            })
            .finally(() => {
                isLoading.value = false
            })
    }

    /**
     * 获取项目名称
     * @param id 项目ID
     * @returns 项目名称
     */
    const getProjectName = (id: ProjectViewObject['id']): ProjectViewObject['name'] => {
        return projectHandler.getProjectName(id)
    }

    /**
     * 获取标签颜色
     * @param id 标签ID
     * @returns 标签颜色
     */
    const getTagColor = (id: TagViewObject['id']): TagViewObject['color'] => {
        return tagHandler.getTagColor(id)
    }

    /**
     * 提供首页视图上下文
     */
    provide(INDEX_VIEW_CONTEXT_KEY, {
        // usecases
        userUseCase,
        projectUseCase,
        tagUseCase,
        taskUseCase,
        // managers
        appDialogManager,
        appSubscriber,
        // handlers
        projectHandler,
        tagHandler,
        taskHandler,
        // responsive
        asideWidth,
        handleResizeAside,
        isDisplayAside,
        isUseFloatAside,
        switchDisplayAside,
        setControllOption,
        isDisplayOutline,
        isUseFloatOutline,
        // methods
        showTaskDetails,
        getProjectName,
        getTagColor
    })

    // @return
    return { isLoading, IndexViewInitialize, appSubscriber }
}

export default useIndexView