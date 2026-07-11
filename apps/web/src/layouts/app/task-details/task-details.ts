import { TaskCommentHandler } from '@/infrastructure/handlers/task-comment'
import { TaskCheckItemHandler } from '@/infrastructure/handlers/task-check-item'
import { TaskHandler } from '@/infrastructure/handlers/task'
import { useProjectsStore, useTagsStore, useTaskDetailsStore } from '@/stores'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { storeToRefs } from 'pinia'
import { computed, inject, provide, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { TASK_CREATOR_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'
import {
    newTaskCheckItemUseCase,
    newTaskCommentUseCase,
    type TaskCheckItemViewObject,
    type TaskViewObject
} from '@nao-todo/usecases/task'
import type { TaskDetailsEmits, TaskDetailsProps, TaskDetailsViewObject } from './types'
import { TASK_DETAILS_CONTEXT_KEY, TASK_DETAILS_PRE_CONTEXT_KEY } from './context'
import useSubTasks from './use-subtasks'

const useTaskDetails = (props: TaskDetailsProps, emit: TaskDetailsEmits) => {
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
    const {
        checkItemIdsCheckItems: checkItems,
        commentIdsComments: comments,
        checkItemsLoading,
        checkItemsError,
        commentsLoading,
        commentsError
    } = storeToRefs(taskDetailsStore)

    /**
     * 用例
     * @use EventUseCase 任务检查事项用例
     * @use CommentUseCase 任务评论用例
     */
    const taskCheckItemUseCase = newTaskCheckItemUseCase(taskDetailsStore)
    const taskCommentUseCase = newTaskCommentUseCase(taskDetailsStore)

    // @hook 子任务加载器
    const { subTaskUseCase, subTasks, subTasksLoading, subTasksError, loadSubTasks, retrySubTasks } =
        useSubTasks(taskDetailsStore)

    /**
     * 处理程序
     * @use TaskHandler 任务处理程序
     * @use TaskCheckItemHandler 任务检查事项处理程序
     * @use TaskCommentHandler 任务评论处理程序
     */
    const taskHandler = new TaskHandler(taskUseCase, subscriber)
    const subTaskHandler = new TaskHandler(subTaskUseCase, subscriber)
    const taskCheckItemHandler = new TaskCheckItemHandler(taskCheckItemUseCase, subscriber)
    const taskCommentHandler = new TaskCommentHandler(taskCommentUseCase, subscriber)

    // @states
    const task = ref<TaskDetailsViewObject | null>(null) /** 任务视图对象 */
    const loading = ref(false) /** 加载状态 */
    const error = ref('') /** 错误信息 */
    const isCommenting = ref(false) /** 是否正在评论 */
    const currentTaskId = ref<string | null>(null) /** 当前任务 ID */

    /**
     * 获取任务详情并转换为视图对象
     */
    const getTaskDetails = async () => {
        if (!props.taskId) return
        error.value = ''
        loading.value = true
        const [_task, err] = await taskUseCase.get(props.taskId)
        loading.value = false
        if (err !== null) {
            error.value = unwrapError(err)
            return
        }
        task.value = {
            id: _task.id,
            userId: _task.userId,
            parentTaskId: _task.parentTaskId,
            name: _task.name,
            description: _task.description,
            state: _task.state,
            priority: _task.priority,
            startAt: _task.startAt,
            endAt: _task.endAt,
            projectId: _task.projectId,
            tags: _task.tags,
            createdAt: _task.createdAt,
            updatedAt: _task.updatedAt,
            deletedAt: _task.deletedAt,
            starMarkAt: _task.starMarkAt,
            givenUpAt: _task.givenUpAt,
            archivedAt: _task.archivedAt,
            remindAt: _task.remindAt,
            remindRepeat: _task.remindRepeat,
            remindTime: _task.remindTime,
            remindWeekdays: _task.remindWeekdays,
            // Others
            isDone: _task.state === 'done',
            isDeleted: _task.isDeleted,
            isStarMarked: _task.isStarMarked,
            isGivenUp: _task.isGivenUp,
            isArchived: _task.isArchived,
            tagList: _task.tags.map((tagId) => tagStore.getTag(tagId)!).filter(Boolean),
            projectName: getProjectName(_task.projectId || '')
        }
    }

    /**
     * 计算检查事项进度
     */
    const checkItemProgress = computed(() => {
        const _e = checkItems.value
        const progress = _e ? _e.filter((event) => event.isDone).length : 0
        const total = _e ? _e.length : 0
        const percentage = total ? Math.floor((progress / total) * 100) : 0
        const text = total ? `已完成 ${progress}/${total}, ${percentage}%` : '暂无检查事项'
        return { percentage, text }
    })

    /**
     * 加载检查事项
     * @param taskId 任务 ID
     */
    const loadCheckItems = async (taskId: TaskViewObject['id']) => {
        taskDetailsStore.setCheckItemsLoading(true)
        taskDetailsStore.setCheckItemsError('')
        const [, err] = await taskCheckItemUseCase.list(taskId)
        if (err !== null) {
            taskDetailsStore.setCheckItemsError('检查事项获取失败：' + unwrapError(err))
        }
        taskDetailsStore.setCheckItemsLoading(false)
    }
    const retryCheckItems = async () => {
        if (!currentTaskId.value) return
        await loadCheckItems(currentTaskId.value)
    }

    /**
     * 加载评论
     * @param taskId 任务 ID
     */
    const loadComments = async (taskId: TaskViewObject['id']) => {
        taskDetailsStore.setCommentsLoading(true)
        taskDetailsStore.setCommentsError('')
        const [, err] = await taskCommentUseCase.list(taskId)
        if (err !== null) {
            taskDetailsStore.setCommentsError('评论获取失败：' + unwrapError(err))
        }
        taskDetailsStore.setCommentsLoading(false)
    }
    const retryComments = async () => {
        if (!currentTaskId.value) return
        await loadComments(currentTaskId.value)
    }

    /**
     * 初始化任务详情
     * @param taskId 任务 ID
     */
    const initialize = async (taskId?: TaskViewObject['id']) => {
        error.value = ''
        // 1. 判断任务 ID
        if (!taskId) return
        currentTaskId.value = taskId
        // 2. 并行获取检查事项、评论和子任务
        await Promise.all([
            getTaskDetails(),
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

    /**
     * 将检查事项转换为任务
     * @param eventId 检查事项 ID
     */
    const makeCheckItemToTask = (checkItemId: TaskCheckItemViewObject['id']) => {
        const checkItem = checkItems.value.find((checkItem) => checkItem.id === checkItemId)
        if (!checkItem) return
        dialogManager.open(TASK_CREATOR_DIALOG_KEY, {
            name: checkItem.name,
            state: checkItem.isDone ? 'done' : 'todo'
        })
    }

    // @watch 监听任务 ID
    watch(
        () => props.taskId,
        (newId) => initialize(newId),
        { immediate: true }
    )

    // @description 排序检查事项
    const resortCheckItems = async (
        oeid: TaskCheckItemViewObject['id'],
        teid: TaskCheckItemViewObject['id'],
        isUp: boolean
    ) => {
        return await taskCheckItemUseCase.resort(oeid, teid, isUp)
    }

    // @provide 任务详情面板上下文
    provide(TASK_DETAILS_CONTEXT_KEY, {
        dialogManager,
        // ---
        emit,
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
        checkItemHandler: taskCheckItemHandler,
        commentHandler: taskCommentHandler,
        // ---
        checkItemProgress,
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
        // ---
        resortCheckItems,
        makeCheckItemToTask
    })

    // @returns 返回值
    return { loading, error, task, closeDetails }
}

export default useTaskDetails


