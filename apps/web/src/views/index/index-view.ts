import useResponsiveAside from '@/infrastructure/hooks/use-responsive-aside'
import { useDialogManager } from '@/infrastructure/hooks/use-dialog-manager'
import {
    useThemeStore,
    useUserStore,
    type ThemeMode,
    useProjectsStore,
    useTagsStore,
    useTasksStore
} from '@/stores'
import useSubscriber from '@nao-todo/infrastructure/hooks/use-subscriber'
import { responsiveTypes } from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import { inject, provide, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
    PROJECT_CREATOR_DIALOG_KEY,
    TASK_CREATOR_DIALOG_KEY,
    TASK_REMINDER_DIALOG_KEY
} from '@/infrastructure/constants/dialog-keys'
import { LAST_VISITED_ROUTE_KEY } from '@/router'
import useScope from '@/infrastructure/hooks/use-scope'
import useShortcut from '@/infrastructure/hooks/use-shortcut'
import { newUserUseCase } from '@nao-todo/usecases/user'
import { newTaskUseCase, type TaskViewObject } from '@nao-todo/usecases/task'
import { newProjectUseCase, ProjectViewObject } from '@nao-todo/usecases/project'
import { newTagUseCase, TagViewObject } from '@nao-todo/usecases/tag'
import { SSEReminderEvent } from '@nao-todo/types/viewobjects/sse'
import { ProjectHandler } from '@/infrastructure/handlers/project'
import { TagHandler } from '@/infrastructure/handlers/tag'
import { TaskHandler } from '@/infrastructure/handlers/task'
import { INDEX_VIEW_CONTEXT_KEY } from './context'
import { APP_CONTEXT_KEY } from '@/context'

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
    const userUseCase = newUserUseCase(userStore)
    const projectUseCase = newProjectUseCase(projectsStore)
    const tagUseCase = newTagUseCase(tagsStore)
    const taskUseCase = newTaskUseCase(tasksStore)

    // @dialogManager 对话框管理器
    // @subscriber 事件订阅器
    const dialogManager = useDialogManager()
    const subscriber = useSubscriber()

    // @handlers 处理层
    const projectHandler = new ProjectHandler(projectUseCase, projectsStore, subscriber)
    const tagHandler = new TagHandler(tagUseCase, tagsStore, subscriber)
    const taskHandler = new TaskHandler(taskUseCase, subscriber)

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
    } = useResponsiveAside(responsiveFlag, responsiveTypes.MOBILE)
    const { visible: isDisplayOutline, isFloating: isUseFloatOutline } = useResponsiveAside(
        responsiveFlag,
        responsiveTypes.MOBILE_TABLE
    )

    /**
     * 显示任务详情抽屉
     * @param taskId 任务 ID
     */
    const showTaskDetails = (taskId: TaskViewObject['id']) => {
        router.push({ name: router.currentRoute.value.name, params: { taskId } })
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
        dialogManager,
        subscriber,
        // handlers
        projectHandler,
        tagHandler,
        taskHandler,
        // responsive
        isDisplayAside,
        isUseFloatAside,
        switchDisplayAside,
        isDisplayOutline,
        isUseFloatOutline,
        // methods
        showTaskDetails,
        getProjectName,
        getTagColor
    })

    // @return
    return { isLoading, IndexViewInitialize }
}

export default useIndexView

