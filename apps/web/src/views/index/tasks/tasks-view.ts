import { BuiltInProjectUseCase } from '@nao-todo/application/web/usecases/built-in-project'
import { responsiveTypes } from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import useResponsiveAside from '@/infrastructure/hooks/use-responsive-aside'
import { columnLabels } from '@nao-todo/infrastructure/consts/tasks'
import { useRouter } from 'vue-router'
import { type DialogManager } from '@/infrastructure/hooks/use-dialog-manager'
import useAsideWidth from '@nao-todo/infrastructure/hooks/use-aside-width'
import { inject, provide, ref, type Ref } from 'vue'
import {
    APP_CONTEXT_KEY,
    INDEX_VIEW_CONTEXT_KEY,
    TASKS_VIEW_CONTEXT_KEY
} from '@/infrastructure/constants/context-keys'
import { useBuiltInProjectsStore, useProjectsStore, useTagsStore } from '@/stores'
import { type Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import type { AppContext } from '@/app'
import type { IndexViewContext } from '@/views/index/index-view'
import type { TagViewObject, TaskViewObject } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { ProjectUseCase } from '@nao-todo/application/web/usecases/project'
import { TagUseCase } from '@nao-todo/application/web/usecases/tag'
import { TaskUseCase } from '@nao-todo/application/web/usecases/task'

export type TasksViewContext = {
    appContext: AppContext
    builtInProjectUseCase: BuiltInProjectUseCase
    projectUseCase: ProjectUseCase
    tagUseCase: TagUseCase
    taskUseCase: TaskUseCase
    dialogManager: DialogManager
    asideWidth: Ref<string>
    isDisplayAside: Ref<boolean>
    isUseFloatAside: Ref<boolean>
    outlineWidth: Ref<string>
    isDisplayOutline: Ref<boolean>
    isUseFloatOutline: Ref<boolean>
    subscriber: Subscriber
    handleResizeAside: (width: number) => void
    handleResizeOutline: (width: number) => void
    getProjectName: (projectId: string) => string
    getTagColor: (tagId: TagViewObject['id']) => string
    showTaskDetails: (taskId: TaskViewObject['id']) => void
    getColumnLabel: (key: string) => string
    switchDisplayAside: () => void
}

const useTasksView = () => {
    // @context App 上下文
    const appContext = inject<AppContext>(APP_CONTEXT_KEY)!

    // @context IndexView 上下文（共享 dialogManager、useCase 等）
    const indexViewContext = inject<IndexViewContext>(INDEX_VIEW_CONTEXT_KEY)!

    // @context 路由上下文
    const router = useRouter()

    // @stores
    const builtInProjectsStore = useBuiltInProjectsStore()
    const projectsStore = useProjectsStore()
    const tagsStore = useTagsStore()

    // @usecases
    const builtInProjectUseCase = BuiltInProjectUseCase.create(builtInProjectsStore)
    const projectUseCase = indexViewContext.projectUseCase
    const tagUseCase = indexViewContext.tagUseCase
    const taskUseCase = indexViewContext.taskUseCase

    // @hook 事件订阅器
    const subscriber = indexViewContext.subscriber

    // @states&method 初始化处理程序
    const isLoading = ref<boolean>(true) // 加载状态
    const error = ref<string>('') // 错误信息
    // 初始化处理程序
    const init = () => {
        Promise.allSettled([
            () => (isLoading.value = true),
            builtInProjectUseCase.loadBuiltInProjects(),
            projectUseCase.loadProjects(),
            tagUseCase.loadTags()
        ])
            .then((results) => {
                results.forEach((result) => {
                    if (result.status !== 'rejected') return
                    error.value = unwrapError(result.reason)
                })
            })
            .finally(() => (isLoading.value = false))
    }

    // @hook 响应式侧边栏
    const {
        visible: isDisplayAside,
        isFloating: isUseFloatAside,
        switchVisible: switchDisplayAside
    } = useResponsiveAside(appContext.responsiveFlag, responsiveTypes.MOBILE)

    // @hook 响应式任务详情面板
    const { visible: isDisplayOutline, isFloating: isUseFloatOutline } = useResponsiveAside(
        appContext.responsiveFlag,
        responsiveTypes.MOBILE_TABLE
    )

    // @hook 侧边栏宽度
    const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(
        256,
        'TASKS_ASIDE_WIDTH'
    )

    // @hook 任务详情面板宽度
    const { width: outlineWidth, updater: handleResizeOutline } = useAsideWidth(
        480,
        'TASKS_OUTLINE_WIDTH'
    )

    // @hook 对话框管理器（复用 IndexView 实例）
    const dialogManager = indexViewContext.dialogManager

    // @method 获取列选项标识
    const getColumnLabel = (key: string): string =>
        (columnLabels.value as Record<string, string>)[key] || ''

    // @method 显示任务详情（面板）
    const showTaskDetails = (taskId: TaskViewObject['id']) => {
        if (!taskId) return
        router.push({ params: { taskId } })
    }

    // @method 获取标签颜色
    const getTagColor = (tagId: TagViewObject['id']): string => {
        return tagsStore.getTag(tagId)?.color || 'transparent'
    }

    // @method 获取清单名称
    const getProjectName = (projectId: string) => {
        return projectsStore.getProject(projectId)?.name || '收集箱'
    }

    // @provide Tasks view context
    provide<TasksViewContext>(TASKS_VIEW_CONTEXT_KEY, {
        appContext,
        builtInProjectUseCase,
        projectUseCase,
        tagUseCase,
        taskUseCase,
        dialogManager,
        asideWidth,
        isDisplayAside,
        isUseFloatAside,
        outlineWidth,
        isDisplayOutline,
        isUseFloatOutline,
        subscriber,
        handleResizeAside,
        handleResizeOutline,
        getColumnLabel,
        showTaskDetails,
        getTagColor,
        getProjectName,
        switchDisplayAside
    })

    // @returns
    return { isLoading, error, init }
}

export default useTasksView

