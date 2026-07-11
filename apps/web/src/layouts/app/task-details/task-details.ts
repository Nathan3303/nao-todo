import { TaskHandler } from '@/infrastructure/handlers/task'
import { useProjectsStore, useTagsStore, useTaskDetailsStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { inject, provide, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { TaskViewObject } from '@nao-todo/usecases/task'
import type { TaskDetailsProps } from './types'
import { TASK_DETAILS_CONTEXT_KEY, TASK_DETAILS_PRE_CONTEXT_KEY } from './context'
import useTaskViewObject from './use-task-view-object'
import useCheckItems from './use-check-items'
import useComments from './use-comments'
import useSubTasks from './use-subtasks'

const useTaskDetails = (props: TaskDetailsProps) => {
    // @viewContext TaskDetailsPre context
    const { taskUseCase, subscriber, dialogManager, getProjectName } = inject(
        TASK_DETAILS_PRE_CONTEXT_KEY
    )!

    // @dataStore
    const router = useRouter()
    const projectStore = useProjectsStore()
    const tagStore = useTagsStore()
    const taskDetailsStore = useTaskDetailsStore()

    // @presetStates
    const { avaliableProjects: projects } = storeToRefs(projectStore)
    const { tags } = storeToRefs(tagStore)

    // @hook 主任务详情
    const { task, loading, error, getTaskDetails } = useTaskViewObject(
        taskUseCase,
        tagStore,
        getProjectName
    )

    // @hook 检查事项
    const {
        checkItemHandler,
        checkItems,
        checkItemsLoading,
        checkItemsError,
        checkItemProgress,
        loadCheckItems,
        retryCheckItems,
        makeCheckItemToTask,
        resortCheckItems
    } = useCheckItems(taskDetailsStore, subscriber, dialogManager)

    // @hook 评论
    const {
        commentHandler,
        comments,
        commentsLoading,
        commentsError,
        isCommenting,
        loadComments,
        retryComments
    } = useComments(taskDetailsStore, subscriber)

    // @hook 子任务
    const {
        subTaskUseCase,
        subTasks,
        subTasksLoading,
        subTasksError,
        subTaskProgress,
        loadSubTasks,
        retrySubTasks,
        createSubTask
    } = useSubTasks(taskDetailsStore)

    // @handler 任务/子任务处理程序
    const taskHandler = new TaskHandler(taskUseCase, subscriber)
    const subTaskHandler = new TaskHandler(subTaskUseCase, subscriber)

    /**
     * 初始化任务详情
     * @param taskId 任务 ID
     */
    const initialize = async (taskId?: TaskViewObject['id']) => {
        error.value = ''
        // 1. 判断任务 ID
        if (!taskId) return
        // 2. 并行获取任务详情、检查事项、评论和子任务
        await Promise.all([
            getTaskDetails(taskId),
            loadCheckItems(taskId),
            loadComments(taskId),
            loadSubTasks(taskId)
        ])
        return null
    }

    /**
     * 关闭任务详情面板
     */
    const closeDetails = () => {
        router.push({ name: router.currentRoute.value.name, params: { taskId: '' } })
    }

    /**
     * 重写路由并加载任务详情
     * @param taskId 任务 ID
     */
    const switchTaskDetails = (taskId: TaskViewObject['id']) => {
        router.push({ name: router.currentRoute.value.name, params: { taskId } })
    }

    // @watch 监听任务 ID
    watch(
        () => props.taskId,
        (newId) => initialize(newId),
        { immediate: true }
    )

    // @provide 任务详情面板上下文
    provide(TASK_DETAILS_CONTEXT_KEY, {
        dialogManager,
        // ---
        vo: task,
        // ---
        projects,
        tags,
        checkItems,
        comments,
        subTasks,
        // ---
        taskHandler,
        subTaskHandler,
        checkItemHandler,
        commentHandler,
        // ---
        checkItemProgress,
        subTaskProgress,
        isCommenting,
        // ---
        checkItemsLoading,
        checkItemsError,
        commentsLoading,
        commentsError,
        subTasksLoading,
        subTasksError,
        // ---
        switchTaskDetails,
        closeDetails,
        // ---
        retryCheckItems,
        retryComments,
        retrySubTasks,
        createSubTask,
        // ---
        resortCheckItems,
        makeCheckItemToTask
    })

    // @returns 返回值
    return { loading, error, task, closeDetails }
}

export default useTaskDetails
