import { computed, inject, provide, watch } from 'vue'
import { useRouter } from 'vue-router'
import { PROJECT_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { ProjectViewContext, ProjectViewProps } from './types'
import useSubscriber from '@/infrastructure/hooks/use-subscriber'
import useUserStore from '@nao-todo/application/web/stores/user-store'
import { storeToRefs } from 'pinia'
import { TaskUseCase } from '@nao-todo/application/web/usecases/task'
import { TaskDomain } from '@nao-todo/domain/task'
import { useTaskRepository } from '@nao-todo/infrastructure/backend/task/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { useProjectsStore, useTagsStore, useTasksStore } from '@/stores/tasks'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'
import { TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { ProjectHandler } from '@/handlers/tasks/project-handler'

const useProjectView = (props: ProjectViewProps) => {
    // @viewStores
    const router = useRouter()

    // @viewContext TasksView context
    const tasksViewContext = inject<TasksViewContext>(TASKS_VIEW_CONTEXT_KEY)!

    // @dataStores
    const userStore = useUserStore()
    const projectsStore = useProjectsStore()
    const tagsStore = useTagsStore()
    const tasksStore = useTasksStore()

    // @presetStates
    const { projectPreference: preference } = storeToRefs(projectsStore)
    const { profile } = storeToRefs(userStore)
    const { tags } = storeToRefs(tagsStore)

    // @hooks 事件监听
    const subscriber = useSubscriber()

    // @method 视图切换
    const switchViewType = (viewType: string) => {
        if (!viewType) return
        if (viewType === (router.currentRoute.value.params.viewType as string)) return
        router.replace({ name: 'tasks-project-main', params: { viewType } })
    }

    // @state 清单详情
    const project = computed(() => {
        if (!props.projectId) return void 0
        return projectsStore.getProject(props.projectId)
    })

    // @method 初始化 - 触发获取清单详情
    const initialize = async () => {
        // 1. 检查参数
        if (!props.projectId || !profile.value) return
        // 2. 获取清单详情
        const err = await tasksViewContext.projectUseCase.loadProjectPreference(props.projectId)
        if (err !== null) {
            NueMessage.error(unwrapError(err))
            return
        }
        // 3. 跳转至指定视图类型
        switchViewType(preference.value?.viewType || 'table')
    }

    // @watch 监听 projectId 变化
    // 当 projectId 变化时，触发获取清单详情
    watch(
        () => props.projectId,
        () => initialize(),
        { immediate: true }
    )

    // @usecase 任务用例
    const taskUseCase = new TaskUseCase(
        new TaskDomain(useTaskRepository(getRequesterImpl())),
        tasksStore
    )

    // @handler 清单操作器
    const projectHandler = new ProjectHandler(
        taskUseCase,
        tasksViewContext.projectUseCase,
        projectsStore,
        subscriber
    )

    // @computed 是否已经是只显示未完成任务
    const isHideCompletedAlready = computed(() => {
        if (!preference.value) return false
        const state = projectsStore.getPreferenceGetTasksOption('state')
        // console.log(state)
        return state == 'todo,in-progress'
    })

    // @provide 提供 Project View 上下文
    provide<ProjectViewContext>(PROJECT_VIEW_CONTEXT_KEY, {
        tasksViewContext,
        taskUseCase,
        project,
        preference,
        profile,
        tags: computed(() => [...tags.value.values()]),
        subscriber,
        projectHandler,
        isHideCompletedAlready,
        getColumnLabel: tasksViewContext.getColumnLabel,
        getProjectName: tasksViewContext.getProjectName,
        showTaskDetails: tasksViewContext.showTaskDetails,
        switchViewTypeToTable: () => switchViewType('table'),
        switchViewTypeToKanban: () => switchViewType('kanban'),
        switchViewTypeToList: () => switchViewType('list'),
        showTaskCreator: () => tasksViewContext.dialogManager.openDialog('task-creator', {})
    })

    // @returns
    return { initialize }
}

export default useProjectView
