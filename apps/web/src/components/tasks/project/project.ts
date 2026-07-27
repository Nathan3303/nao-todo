import { computed, inject, provide, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { ProjectViewProps } from './types'
import { useUserStore } from '@nao-todo/presentation/user'
import { storeToRefs } from 'pinia'
import { ProjectHandler, useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { NueMessage } from 'nue-ui'
import { unwrapError, TASK_CREATOR_DIALOG_KEY } from '@nao-todo/shared'
import { TASKS_VIEW_CONTEXT_KEY } from '@/views/index/tasks/context'
import { PROJECT_VIEW_CONTEXT_KEY } from './context'

const useProjectView = (props: ProjectViewProps) => {
    // @viewStores
    const router = useRouter()

    // @viewContext TasksView context
    const {
        projectUseCase,
        taskUseCase,
        appSubscriber,
        appDialogManager,
        getColumnLabel,
        getProjectName,
        showTaskDetails
    } = inject(TASKS_VIEW_CONTEXT_KEY)!

    // @dataStores
    const userStore = useUserStore()
    const projectsStore = useProjectsStore()
    const tagsStore = useTagsStore()

    // @presetStates
    const { projectPreference: preference } = storeToRefs(projectsStore)
    const { profile } = storeToRefs(userStore)
    const { tags } = storeToRefs(tagsStore)

    // @state 加载态
    const loading = ref(true)

    // @method 视图切换
    const switchViewType = async (viewType: string) => {
        if (!viewType) return
        if (viewType === (router.currentRoute.value.params.viewType as string)) return
        return router.replace({ name: 'tasks-project-main', params: { viewType } }).then(() => {
            preference.value!.viewType = viewType
        })
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
        loading.value = true
        // 2. 获取清单详情
        const err = await projectUseCase.loadProjectPreference(props.projectId)
        if (err !== null) {
            NueMessage.error(unwrapError(err))
            return
        }
        // 3. 跳转至指定视图类型
        await switchViewType(preference.value?.viewType || 'table')
        loading.value = false
    }

    // @watch 监听 projectId 变化
    // 当 projectId 变化时，触发获取清单详情
    watch(
        () => props.projectId,
        () => initialize(),
        { immediate: true }
    )

    // @handler 清单操作器
    const projectHandler = new ProjectHandler(projectUseCase, projectsStore, appSubscriber)

    // @computed 是否已经是只显示未完成任务
    const isHideCompletedAlready = computed(() => {
        if (!preference.value) return false
        const state = projectsStore.getPreferenceGetTasksOption('state')
        // console.log(state)
        return state == 'todo,in-progress'
    })

    // @method 显示任务创建器弹窗
    const showTaskCreator = () => {
        appDialogManager.open(TASK_CREATOR_DIALOG_KEY, {
            projectId: props.projectId
        })
    }

    // @provide 提供 Project View 上下文
    provide(PROJECT_VIEW_CONTEXT_KEY, {
        taskUseCase,
        projectUseCase,
        subscriber: appSubscriber,
        dialogManager: appDialogManager,
        projectHandler,
        project,
        preference,
        tags: computed(() => [...tags.value.values()]),
        profile,
        isHideCompletedAlready,
        getColumnLabel: getColumnLabel,
        getProjectName: getProjectName,
        showTaskDetails: showTaskDetails,
        showTaskCreator,
        switchViewTypeToTable: () => switchViewType('table'),
        switchViewTypeToKanban: () => switchViewType('kanban'),
        switchViewTypeToList: () => switchViewType('list')
    })

    // @returns
    return { initialize, loading }
}

export default useProjectView