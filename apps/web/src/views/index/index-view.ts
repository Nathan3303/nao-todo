import { useAppAsideV2Controller } from '@/components/app/aside-v2'
import { isSettingsDialogOpen } from '@/components/settings/dialog/state'
import { APP_CONTEXT_KEY } from '@/context'
import {
    useAppHandlers,
    useProjectUseCase,
    useScope,
    useShortcut,
    useTagUseCase,
    useTaskUseCase,
    useUserUseCase
} from '@/hooks'
import { LAST_VISITED_ROUTE_KEY } from '@/router'
import { safeReplaceDeepLink } from '@/safe-navigation'
import { ThemeMode } from '@nao-todo/domain-identity'
import { ProjectViewObject } from '@nao-todo/domain-project'
import { TagViewObject } from '@nao-todo/domain-tag'
import { TaskViewObject } from '@nao-todo/domain-task'
import { useThemeStore, useUserStore } from '@nao-todo/presentation-identity'
import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { useStoreInvalidationHub, useTasksStore } from '@nao-todo/presentation/task'
import {
    PROJECT_CREATOR_DIALOG_KEY,
    TASK_CREATOR_DIALOG_KEY,
    TASK_REMINDER_DIALOG_KEY
} from '@nao-todo/shared/constants'
import {
    responsiveTypes,
    useAsideWidth,
    useDialogManager,
    useResponsiveAside,
    useSubscriber
} from '@nao-todo/shared/hooks'
import { sendNotification } from '@nao-todo/shared/utils/notification'
import { markPreferenceDirty } from '@nao-todo/infrastructure/src/persistence-sync/preference-sync'
import { getServerTimeOffset } from '@nao-todo/infrastructure/src/persistence-sync/sync-config'
import { listReminderCandidates } from '@nao-todo/infrastructure/src/persistence-local/repos/task-reminder-candidates'
import { createClaimLedger, createReminderEngine } from '@nao-todo/shared/reminder'
import { t } from '@nao-todo/shared/locales'
import { inject, nextTick, onUnmounted, provide, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { INDEX_VIEW_CONTEXT_KEY } from './context'
import { taskDetailsLocation } from './task-details-location'

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

    // @usecases
    const userUseCase = useUserUseCase(userStore)
    const projectUseCase = useProjectUseCase(projectsStore)
    const tagUseCase = useTagUseCase(tagsStore)

    // @dialogManager 对话框管理器
    // @subscriber 事件订阅器
    const appDialogManager = useDialogManager()
    const appSubscriber = useSubscriber()

    // 桌面端同步拉取写入本地库后刷新视图（SyncService 直连表落库绕过 store，
    // 经 'nao-todo:data-changed' 事件重拉项目/标签；Web 端无 SyncService，事件永不触发）
    // 任务侧失效由**应用级失效中心**接管（useStoreInvalidationHub，DEF-STORE-06 方向 1：
    // 失效订阅移出视图域、不再随路由漂移）；本监听仅保留项目/标签重载。
    // 卸载时移除监听，避免路由离开再进入时重复注册导致多次刷新
    if (typeof window !== 'undefined') {
        const handleDataChanged = () => {
            void projectUseCase.loadProjects()
            void tagUseCase.loadTags()
        }
        window.addEventListener('nao-todo:data-changed', handleDataChanged)
        onUnmounted(() => window.removeEventListener('nao-todo:data-changed', handleDataChanged))
    }
    // 应用级失效中心接线（幂等：进程内只注册一次监听；应用级单例不做卸载清理）
    useStoreInvalidationHub()

    // @handlers 应用级 Handler 单例（绑定应用级事件总线与全局 store）
    const { projectHandler, tagHandler } = useAppHandlers()

    /**
     * 快捷键管理器
     * @use n 创建任务
     * @use p 创建项目
     */
    useScope('index-view')
    // 键位作用域化（C1-F8）：'n'/'p' 绑定 index-view scope——避免以无 scope 形式被任意深层 scope
    // 一并纳入而靠注册序抢先；绑定后日历等更深层 scope 可遮蔽 n（日历内 n=格内快速新建），
    // 其余 tab 仍经作用域栈回退执行同一全局动作（C-F8-08 n 遮蔽语义前提）
    useShortcut('task.create', 'n', () => appDialogManager.open(TASK_CREATOR_DIALOG_KEY), {
        scope: 'index-view',
        // SHELL-01：设置对话框等 Nue 弹层开启期间抑制裸键，避免在对话框上层误开创建器
        available: () => !isSettingsDialogOpen(document)
    })
    useShortcut('project.create', 'p', () => appDialogManager.open(PROJECT_CREATOR_DIALOG_KEY), {
        scope: 'index-view',
        available: () => !isSettingsDialogOpen(document)
    })

    /**
     * 边栏响应式状态
     */
    const { isDisplayAside, isUseFloatAside, switchDisplayAside, setControllOption } =
        useAppAsideV2Controller(responsiveFlag)
    const { visible: isDisplayOutline, isFloating: isUseFloatOutline } = useResponsiveAside(
        responsiveFlag,
        responsiveTypes.MOBILE_TABLE
    )
    const { width: asideWidth, updater: handleResizeAsideBase } = useAsideWidth(300, 'ASIDE_WIDTH')
    // TASK-26 / M6：侧边栏宽度属设置面偏好 ⇒ 本地写成功后入偏好队列（整快照回传）
    const handleResizeAside = (newWidth: number) => {
        handleResizeAsideBase(newWidth)
        void markPreferenceDirty('userConfig')
    }

    /**
     * 显示任务详情抽屉
     * @param taskId 任务 ID
     */
    const showTaskDetails = async (taskId: TaskViewObject['id']) => {
        await router.push(taskDetailsLocation(router.currentRoute.value, taskId))
    }

    /**
     * 从用户配置加载主题模式并应用到主题存储
     */
    const loadUserThemeModeFromConfig = () => {
        themeStore.updateTheme(userStore.config?.appearance as ThemeMode | 'system')
    }

    /**
     * 任务提醒引擎（本地轮询，T527）
     * @description 判定只读本机已同步任务 + 本机（校准后）时钟 ⇒ 离线 / 刷新 / 多标签 / 重开一致。
     *              展示前落账（`taskId@remindAt`）跨标签互斥；展示后消费（一次性清空本机 remindAt，
     *              daily/weekly/monthly 推进下一次），本地写走既有同步队列（不新增通道）。
     *              见 PRD §五 R1–R9 · §六 NFR · `packages/shared/reminder`。
     */
    const taskUseCase = useTaskUseCase(useTasksStore())
    const nowCalibratedMs = (): number => Date.now() + getServerTimeOffset()

    /** localStorage 访问：隐私模式下取属性本身可能抛错 ⇒ 交账本退化为内存账本（AC6） */
    const getReminderStorage = (): Storage | undefined => {
        try {
            return typeof localStorage === 'undefined' ? undefined : localStorage
        } catch {
            return undefined
        }
    }

    /** 通知权限请求（仅支持且未决时发起；引擎保证整个生命周期只调一次） */
    const requestReminderNotificationPermission = (): void | Promise<unknown> => {
        if (typeof window === 'undefined' || !('Notification' in window)) return undefined
        if (Notification.permission !== 'default') return undefined
        return Notification.requestPermission()
    }

    const reminderEngine = createReminderEngine({
        listCandidates: () => listReminderCandidates(nowCalibratedMs()),
        now: nowCalibratedMs,
        ledger: createClaimLedger({ storage: getReminderStorage() }),
        notify: (event) => {
            appDialogManager.open(TASK_REMINDER_DIALOG_KEY, event)
            // 系统通知：标题 = 动作语义、正文 = 任务名；点击 = 聚焦 + 打开该任务详情（AC9）
            sendNotification(t('task.reminder.title'), event.taskName, {
                onClick: () => void showTaskDetails(event.taskId)
            })
        },
        consume: async (taskId, nextRemindAt) => {
            await taskUseCase.update(taskId, { remindAt: nextRemindAt })
        },
        requestNotificationPermission: requestReminderNotificationPermission
    })
    /** 延迟启动守卫：视图若在加载态期间卸载 ⇒ 已 stop，不得再拉起轮询（F1） */
    let isViewUnmounted = false
    onUnmounted(() => {
        isViewUnmounted = true
        reminderEngine.stop()
    })

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
        await Promise.all([userUseCase.loadUserProfile(), userUseCase.loadUserConfig()])
            .then(() => {
                if (route.name !== 'index') return
                const lastRoute = localStorage.getItem(LAST_VISITED_ROUTE_KEY)
                // C-35：收敛裸导航（深链校验 + 回退 + 失效键清理）
                return safeReplaceDeepLink(
                    router,
                    [{ key: LAST_VISITED_ROUTE_KEY, value: lastRoute }],
                    '/tasks',
                    'index-view:initialize',
                    localStorage
                )
            })
            .finally(async () => {
                isLoading.value = false
                // F1（T527）：提醒引擎必须在**加载态结束之后**启动。
                // `isLoading=false` 才挂载 `<app-dialog-adapter>`（`TASK_REMINDER_DIALOG_KEY` 在其中注册），
                // 而未注册时 `DialogManager.open` 是 warn + 丢弃 ⇒ 若在加载期扫描，冷启动补弹会
                // 「已落账 + 已消费但弹窗被丢」⇒ 该条永久不再出现。等一帧让挂载完成后再启动首轮扫描。
                await nextTick()
                if (isViewUnmounted) return
                reminderEngine.start()
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
        // managers
        appDialogManager,
        appSubscriber,
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