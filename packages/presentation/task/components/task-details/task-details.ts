import { inject, onMounted, onUnmounted, provide, ref } from 'vue'
import { useRouter } from 'vue-router'
import { TaskHandler } from '../../handlers'
import { useTaskDetailsStore } from '../../stores'
import type { TaskViewObject, UpdateTaskViewObject } from '@nao-todo/domain-task'
import { useMinuteTask, type GoError } from '@nao-todo/shared'
import { TASK_DETAILS_CONTEXT_KEY, TASK_DETAILS_PRE_CONTEXT_KEY } from './context'
import useCheckItems from './use-check-items'
import useComments from './use-comments'
import useSubTasks from './use-subtasks'
import useTaskViewObject from './use-task-view-object'

const useTaskDetails = () => {
    // @viewContext TaskDetailsPre context
    const {
        taskUseCase,
        subscriber,
        dialogManager,
        getTag,
        getProjectName,
        avaliableProjects,
        avaliableTags,
        pomodoroCurrentTaskId,
        pomodoroTimerStatus,
        pomodoroFocusStatus,
        selectTaskAndStartTimer,
        selectTaskAndStartFocus,
        resetTimer,
        resetFocus
    } = inject(TASK_DETAILS_PRE_CONTEXT_KEY)!

    // @dataStore
    const router = useRouter()
    const taskDetailsStore = useTaskDetailsStore()

    // @hook 主任务详情
    const {
        task,
        loading,
        error,
        getTaskDetails,
        updateTaskDetails: rawUpdateTaskDetails,
        deleteTask,
        restoreTask,
        giveUpTask,
        ungiveUpTask
    } = useTaskViewObject(taskUseCase, getTag, getProjectName)

    /**
     * 更新任务详情（父任务变更时联动刷新当前列表）
     * @description 顶层任务被设为子任务（parentTaskId '' → 非空）后即离开列表/表格/看板
     *              （主列表仅含顶层任务），成功后触发 RefreshData 由视图适配器重载移除；
     *              脱离父任务（置空）走 detachSubTask 独立刷新，此处不重复触发。
     */
    const updateTaskDetails = async (
        id: TaskViewObject['id'],
        updateVO: UpdateTaskViewObject
    ): Promise<GoError> => {
        const prevParentId = task.value?.parentTaskId
        const err = await rawUpdateTaskDetails(id, updateVO)
        const becomesSubTask = Boolean(updateVO.parentTaskId) && !prevParentId
        if (err === null && becomesSubTask) {
            subscriber.emit('RefreshData')
        }
        return err
    }

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
    } = useCheckItems(taskDetailsStore, dialogManager)

    // @hook 评论
    const {
        commentHandler,
        comments,
        commentsLoading,
        commentsError,
        isCommenting,
        loadComments,
        retryComments
    } = useComments(taskDetailsStore)

    // @hook 子任务
    const {
        subTaskUseCase,
        subTasks,
        subTasksLoading,
        subTasksError,
        subTaskProgress,
        loadSubTasks,
        retrySubTasks,
        createSubTask,
        detachSubTask
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
        await getTaskDetails(taskId) // 必须获取，才能知道是否为空
        if (!taskId) return
        // 2. 并行获取任务详情、检查事项、评论和子任务
        // 深度限制（仅一级子任务）：当前任务本身是子任务时不再加载其子任务板块
        const isSubTask = Boolean(task.value?.parentTaskId)
        await Promise.all([
            loadCheckItems(taskId),
            loadComments(taskId),
            isSubTask ? null : loadSubTasks(taskId)
        ])
        return null
    }

    /**
     * 任务详情面板切换与关闭
     */
    const closeDetails = () => {
        router.push({ name: router.currentRoute.value.name, params: { taskId: void 0 } })
    }
    const switchTaskDetails = (taskId: TaskViewObject['id']) => {
        router.push({ name: router.currentRoute.value.name, params: { taskId } })
    }

    /**
     * 重新渲染任务详情中的结束日期样式，通过 key 的变化来触发组件的重新渲染，判断条件为结束日期。
     */
    const refreshKey = ref(1)
    const { run: startRefreshKeyIncrement, stop: stopRefreshKeyIncrement } = useMinuteTask(
        () => (refreshKey.value += 1)
    )

    // @onmounted
    onMounted(() => {
        startRefreshKeyIncrement()
    })

    // @onunmounted
    onUnmounted(() => {
        stopRefreshKeyIncrement()
    })

    // @provide 任务详情面板上下文
    provide(TASK_DETAILS_CONTEXT_KEY, {
        dialogManager,
        vo: task,
        refreshKey,
        projects: avaliableProjects,
        tags: avaliableTags,
        checkItems,
        comments,
        subTasks,
        taskHandler,
        subTaskHandler,
        checkItemHandler,
        commentHandler,
        checkItemProgress,
        subTaskProgress,
        isCommenting,
        pomodoroCurrentTaskId,
        pomodoroTimerStatus,
        pomodoroFocusStatus,
        checkItemsLoading,
        checkItemsError,
        commentsLoading,
        commentsError,
        subTasksLoading,
        subTasksError,
        updateTaskDetails,
        deleteTask,
        restoreTask,
        giveUpTask,
        ungiveUpTask,
        switchTaskDetails,
        closeDetails,
        retryCheckItems,
        retryComments,
        retrySubTasks,
        createSubTask,
        detachSubTask,
        resortCheckItems,
        makeCheckItemToTask,
        selectTaskAndStartTimer,
        selectTaskAndStartFocus,
        resetTimer,
        resetFocus
    })

    // @returns 返回值
    return { loading, error, task, initialize, closeDetails }
}

export default useTaskDetails