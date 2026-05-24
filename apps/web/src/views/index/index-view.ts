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
import { inject, provide, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { TASK_REMINDER_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'
import type { SSEReminderEvent, TaskViewObject } from '@nao-todo/types'

/**
 * 首页视图上下文
 * @description 包含首页视图的所有上下文数据，包括应用上下文、用户使用案例、对话框管理器、项目使用案例、标签使用案例、任务使用案例、事件订阅器、边栏响应式状态等。
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
    showTaskDetailsDrawer: (taskId: TaskViewObject['id']) => void
}

/**
 * 首页视图
 * @description 提供首页视图的所有上下文数据和方法，包括应用上下文、用户使用案例、对话框管理器、项目使用案例、标签使用案例、任务使用案例、事件订阅器、边栏响应式状态等。
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
    const showTaskDetailsDrawer = (taskId: TaskViewObject['id']) => {
        router.push({ name: router.currentRoute.value.name, params: { taskId } })
    }

    /**
     * SSE 提醒连接
     */
    const connectReminderSSE = () => {
        const token = localStorage.getItem('USER_JWT')
        const url = `${import.meta.env.VITE_API_BASE_URL}/sse/reminders?token=${token}`
        const es = new EventSource(url)
        es.addEventListener('reminder', (event: MessageEvent) => {
            const data = JSON.parse(event.data) as SSEReminderEvent
            dialogManager.open(TASK_REMINDER_DIALOG_KEY, data)
        })
        es.addEventListener('error', () => {
            es.close()
        })
    }
    connectReminderSSE()

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
        showTaskDetailsDrawer
    })

    // @return
    return {
        appContext,
        userUseCase,
        loadUserThemeModeFromConfig
    }
}

export default useIndexView

