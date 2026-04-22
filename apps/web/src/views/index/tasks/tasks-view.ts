import { BuiltInProjectUseCase } from '@nao-todo/application/web/usecases/built-in-project'
import { ProjectUseCase } from '@nao-todo/application/web/usecases/project'
import { TagUseCase } from '@nao-todo/application/web/usecases/tag'
import { BuiltInProjectDomain } from '@nao-todo/domain/built-in-project/services'
import { ProjectDomain } from '@nao-todo/domain/project'
import { TagDomain } from '@nao-todo/domain/tag'
import { useProjectRepository } from '@nao-todo/infrastructure/backend/project/repoImpl'
import { useTagRepository } from '@nao-todo/infrastructure/backend/tag/repoImpl'
import useBuiltInProjectRepository from '@nao-todo/infrastructure/built-in/project/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { responsiveTypes } from '@nao-todo/infrastructure/hooks/use-responsive-flag'
import useResponsiveAside from '@/infrastructure/hooks/use-responsive-aside'
import { columnLabels } from '@nao-todo/infrastructure/consts/tasks'
import { useRouter } from 'vue-router'
import useDialogManager, { type DialogManager } from '@/infrastructure/hooks/use-dialog-manager'
import useAsideWidth from '@nao-todo/infrastructure/hooks/use-aside-width'
import { inject, provide, ref, type Ref } from 'vue'
import { APP_CONTEXT_KEY, TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import { TaskDomain } from '@nao-todo/domain/task'
import { useTaskRepository } from '@nao-todo/infrastructure/backend/task/repoImpl'
import { useTasksStore } from '@/stores/tasks'
import { useBuiltInProjectsStore, useProjectsStore, useTagsStore } from '@/stores/tasks'
import useSubscriber, { type Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import type { AppContext } from '@/app'
import type { Tag, Task } from '@nao-todo/types'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'

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
    getTagColor: (tagId: Tag['id']) => string
    showTaskDetails: (taskId: Task['id']) => void
    getColumnLabel: (key: string) => string
    switchDisplayAside: () => void
}

const useTasksView = () => {
    // @context App 上下文
    const appContext = inject<AppContext>(APP_CONTEXT_KEY)!

    // @context 路由上下文
    const router = useRouter()

    // @stores
    const builtInProjectsStore = useBuiltInProjectsStore()
    const projectsStore = useProjectsStore()
    const tagsStore = useTagsStore()
    const tasksStore = useTasksStore()

    // @domains
    const requesterImpl = getRequesterImpl()
    const bipDomain = new BuiltInProjectDomain(useBuiltInProjectRepository())
    const projectDomain = new ProjectDomain(useProjectRepository(requesterImpl))
    const tagDomain = new TagDomain(useTagRepository(requesterImpl))
    const taskDomain = new TaskDomain(useTaskRepository(requesterImpl))

    // @usecases
    const builtInProjectUseCase = new BuiltInProjectUseCase(bipDomain, builtInProjectsStore)
    const projectUseCase = new ProjectUseCase(projectDomain, projectsStore)
    const tagUseCase = new TagUseCase(tagDomain, tagsStore)
    const taskUseCase = new TaskUseCase(taskDomain, tasksStore)

    // @hook 事件订阅器
    const subscriber = useSubscriber()

    // @states&method 初始化处理程序
    const isLoading = ref<boolean>(true) // 加载状态
    const error = ref<string>('') // 错误信息
    // 初始化处理程序
    const init = () => {
        isLoading.value = true
        Promise.allSettled([
            builtInProjectUseCase.loadBuiltInProjects(),
            projectUseCase.loadProjects(),
            tagUseCase.loadTags()
        ]).then((results) => {
            isLoading.value = false
            results.forEach((result) => {
                if (result.status !== 'rejected') return
                error.value = unwrapError(result.reason)
            })
        })
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
    const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(256, 'ASIDE_WIDTH')

    // @hook 任务详情面板宽度
    const { width: outlineWidth, updater: handleResizeOutline } = useAsideWidth(
        480,
        'OUTLINE_WIDTH'
    )

    // @hook 对话框管理器
    const dialogManager = useDialogManager()

    // @method 获取列选项标识
    const getColumnLabel = (key: string): string => columnLabels[key] || ''

    // @method 显示任务详情（面板）
    const showTaskDetails = (taskId: Task['id']) => {
        if (!taskId) return
        router.push({ params: { taskId } })
    }

    // @method 获取标签颜色
    const getTagColor = (tagId: Tag['id']): string => {
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

