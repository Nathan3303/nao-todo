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
import useResponsiveAside from '@/infrastructure/hooks/tasks-view/use-responsive-aside'
import { columnLabels } from '@nao-todo/infrastructure/consts/tasks'
import { useRouter, type NavigationFailure } from 'vue-router'
import type { Tag, Task } from '@nao-todo/types'
import useDialogManager, {
    type DialogManager
} from '@/infrastructure/hooks/tasks-view/use-dialog-manager'
import useAsideWidth from '@nao-todo/infrastructure/hooks/use-aside-width'
import { computed, inject, provide, type Ref } from 'vue'
import type { AppContext } from '@/app'
import { APP_CONTEXT_KEY, TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import useTasksViewInitializeHandler from '@/handlers/tasks/initialize-handler'
import { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import { TaskDomain } from '@nao-todo/domain/task'
import { useTaskRepository } from '@nao-todo/infrastructure/backend/task/repoImpl'
import { useTasksStore } from '@/stores/tasks'
import { useBuiltInProjectsStore, useProjectsStore, useTagsStore } from '@/stores/tasks'

export type TasksViewContext = {
    appContext: AppContext
    builtInProjectUseCase: BuiltInProjectUseCase
    projectUseCase: ProjectUseCase
    tagUseCase: TagUseCase
    taskUseCase: TaskUseCase
    dialogManager: DialogManager
    isDisplayAside: Ref<boolean>
    isDisplayOutline: Ref<boolean>
    getProjectName: (projectId: string) => string
    getTagColor: (tagId: Tag['id']) => string
    showTaskDetails: (taskId: Task['id']) => Promise<void | NavigationFailure>
    getColumnLabel: (key: string) => string
    switchDisplayAside: () => void
}

export default () => {
    // @context App context
    const appContext = inject<AppContext>(APP_CONTEXT_KEY)!

    // @viewStore
    const router = useRouter()

    // @dataStores
    const builtInProjectsStore = useBuiltInProjectsStore()
    const projectsStore = useProjectsStore()
    const tagsStore = useTagsStore()
    const tasksStore = useTasksStore()

    // @usecase 内建清单用例
    const builtInProjectUseCase = new BuiltInProjectUseCase(
        new BuiltInProjectDomain(useBuiltInProjectRepository()),
        builtInProjectsStore
    )

    // @usecase 清单用例
    const projectUseCase = new ProjectUseCase(
        new ProjectDomain(useProjectRepository(getRequesterImpl())),
        projectsStore
    )

    // @usecase 标签用例
    const tagUseCase = new TagUseCase(
        new TagDomain(useTagRepository(getRequesterImpl())),
        tagsStore
    )

    // @usecase 任务用例
    const taskUseCase = new TaskUseCase(
        new TaskDomain(useTaskRepository(getRequesterImpl())),
        tasksStore
    )

    // @hook 任务界面初始化器
    const initializer = useTasksViewInitializeHandler(
        builtInProjectUseCase,
        builtInProjectsStore,
        projectUseCase,
        projectsStore,
        tagUseCase,
        tagsStore
    )

    // @computed 统一的加载态
    const isLoading = computed(() => {
        return builtInProjectsStore.loading || projectsStore.loading || tagsStore.loading
    })

    // @computed 统一的错误态
    const error = computed(() => {
        return builtInProjectsStore.error || projectsStore.error || tagsStore.error
    })

    // @hook 边栏响应式状态
    const {
        visible: isDisplayAside,
        isFloating: isUseFloatAside,
        switchVisible: switchDisplayAside
    } = useResponsiveAside(appContext.responsiveFlag, responsiveTypes.MOBILE)
    const { visible: isDisplayOutline, isFloating: isUseFloatOutline } = useResponsiveAside(
        appContext.responsiveFlag,
        responsiveTypes.MOBILE_TABLE
    )

    // @hook 边栏宽度
    const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(256, 'ASIDE_WIDTH')
    const { width: outlineWidth, updater: handleResizeOutline } = useAsideWidth(
        480,
        'OUTLINE_WIDTH'
    )

    // @hook 对话框管理
    const dialogManager = useDialogManager()

    // @method 获取列选项标识
    const getColumnLabel = (key: string): string => {
        return columnLabels[key] || ''
    }

    // @method 显示任务详情（面板）
    const showTaskDetails = async (taskId: Task['id']) => {
        if (!taskId) return
        return await router.push({
            name: router.currentRoute.value.name,
            params: { taskId }
        })
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
        isDisplayAside,
        isDisplayOutline,
        getColumnLabel,
        showTaskDetails,
        getTagColor,
        getProjectName,
        switchDisplayAside
    })

    // @returns
    return {
        initializer,
        isLoading,
        error,
        asideWidth,
        outlineWidth,
        isDisplayAside,
        isDisplayOutline,
        isUseFloatAside,
        isUseFloatOutline,
        handleResizeAside,
        handleResizeOutline
    }
}
