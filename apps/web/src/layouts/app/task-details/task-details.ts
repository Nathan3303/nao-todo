import useCommentHandler from '@/infrastructure/handlers/tasks/comment-handler'
import useEventHandler from '@/infrastructure/handlers/tasks/event-handler'
import useTaskHandler from '@/infrastructure/handlers/tasks/task-handler'
import {
    usePomodoroStore,
    useProjectsStore,
    useTagsStore,
    useTaskDetailsStore,
    useTasksStore
} from '@/stores'
import { CommentUseCase } from '@nao-todo/application/web/usecases/comment'
import { EventUseCase } from '@nao-todo/application/web/usecases/event'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { storeToRefs } from 'pinia'
import { computed, inject, provide, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { TASK_DETAILS_CONTEXT_KEY, TASK_DETAILS_PRE_CONTEXT_KEY } from './constants'
import { TASK_CREATOR_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'
import type { EventViewObject, TaskViewObject } from '@nao-todo/types'
import type {
    TaskDetailsContext,
    TaskDetailsEmits,
    TaskDetailsPreContext,
    TaskDetailsProps
} from './types'
import { PomodoroRecordUseCase } from '@nao-todo/application/web/usecases/pomodoro'

const useTaskDetails = (props: TaskDetailsProps, emit: TaskDetailsEmits) => {
    // @viewContext TaskDetailsPre context
    const { taskUseCase, subscriber, dialogManager, getProjectName } =
        inject<TaskDetailsPreContext>(TASK_DETAILS_PRE_CONTEXT_KEY)!

    // @dataStore
    const router = useRouter()
    const projectStore = useProjectsStore()
    const tagStore = useTagsStore()
    const taskStore = useTasksStore()
    const pomodoroStore = usePomodoroStore()
    const taskDetailsStore = useTaskDetailsStore()

    // @presetStates
    const { avaliableProjects: projects } = storeToRefs(projectStore)
    const { tags } = storeToRefs(tagStore)
    const {
        eventIdsEvents: events,
        commentIdsComments: comments,
        eventsLoading,
        eventsError,
        commentsLoading,
        commentsError
    } = storeToRefs(taskDetailsStore)

    /**
     * 用例
     * @use EventUseCase 任务检查事项用例
     * @use CommentUseCase 任务评论用例
     */
    const eventUseCase = EventUseCase.create(taskDetailsStore)
    const commentUseCase = CommentUseCase.create(taskDetailsStore)
    const pomodoroUseCase = PomodoroRecordUseCase.create(pomodoroStore)

    /**
     * 处理程序
     * @use EventEventHandler 任务检查事项处理程序
     * @use CommentHandler 任务评论处理程序
     * @use TaskHandler 任务处理程序
     */
    const eventHandler = useEventHandler(eventUseCase)
    const commentHandler = useCommentHandler(commentUseCase)
    const taskHandler = useTaskHandler(taskUseCase, subscriber)

    // @states
    const loading = ref(false) /** 加载状态 */
    const error = ref('') /** 错误信息 */
    const isCommenting = ref(false) /** 是否正在评论 */
    const currentTaskId = ref<string | null>(null) /** 当前任务 ID */

    /**
     * 获取任务详情并转换为视图对象
     */
    const task = computed(() => {
        if (!props.taskId) return null
        const _task = taskStore.getTask(props.taskId)
        // console.log(_task)
        return _task
            ? {
                  id: _task.id,
                  userId: _task.userId,
                  parentTaskId: _task.parentTaskId,
                  name: _task.name,
                  description: _task.description,
                  state: _task.state,
                  isDone: _task.state === 'done',
                  priority: _task.priority,
                  startAt: _task.startAt,
                  endAt: _task.endAt,
                  projectId: _task.projectId,
                  projectName: getProjectName(_task.projectId),
                  tags: _task.tags,
                  tagList: _task.tags.map((tagId) => tagStore.getTag(tagId)!).filter(Boolean),
                  createdAt: _task.createdAt,
                  updatedAt: _task.updatedAt,
                  deletedAt: _task.deletedAt,
                  isDeleted: _task.isDeleted,
                  starMarkAt: _task.starMarkAt,
                  isStarMarked: _task.isStarMarked,
                  givenUpAt: _task.givenUpAt,
                  isGivenUp: _task.isGivenUp,
                  archivedAt: _task.archivedAt,
                  isArchived: _task.isArchived,
                  remindAt: _task.remindAt,
                  remindRepeat: _task.remindRepeat,
                  remindTime: _task.remindTime,
                  remindWeekdays: _task.remindWeekdays
              }
            : null
    })

    /**
     * 计算检查事项进度
     */
    const eventProgress = computed(() => {
        const _e = events.value
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
    const loadEvents = async (taskId: TaskViewObject['id']) => {
        taskDetailsStore.setEventsLoading(true)
        taskDetailsStore.setEventsError('')
        const [, err] = await eventUseCase.loadEvents(taskId)
        if (err !== null) {
            taskDetailsStore.setEventsError('检查事项获取失败：' + unwrapError(err))
        }
        taskDetailsStore.setEventsLoading(false)
    }

    /**
     * 加载评论
     * @param taskId 任务 ID
     */
    const loadComments = async (taskId: TaskViewObject['id']) => {
        taskDetailsStore.setCommentsLoading(true)
        taskDetailsStore.setCommentsError('')
        const [, err] = await commentUseCase.loadComments(taskId)
        if (err !== null) {
            taskDetailsStore.setCommentsError('评论获取失败：' + unwrapError(err))
        }
        taskDetailsStore.setCommentsLoading(false)
    }

    /**
     * 重试加载检查事项
     */
    const retryEvents = async () => {
        if (!currentTaskId.value) return
        await loadEvents(currentTaskId.value)
    }

    /**
     * 重试加载评论
     */
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
        // 2. 并行获取检查事项和评论
        await Promise.all([loadEvents(taskId), loadComments(taskId)])
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
        // initialize(taskId)
    }

    /**
     * 将检查事项转换为任务
     * @param eventId 检查事项 ID
     */
    const makeEventToTask = (eventId: EventViewObject['id']) => {
        const event = events.value.find((e) => e.id === eventId)
        if (!event) return
        dialogManager.open(TASK_CREATOR_DIALOG_KEY, {
            name: event.name,
            state: event.isDone ? 'done' : 'todo'
        })
    }

    // @watch 监听任务 ID
    watch(
        () => props.taskId,
        (newId) => initialize(newId),
        { immediate: true }
    )

    // @provide 任务详情面板上下文
    provide<TaskDetailsContext>(TASK_DETAILS_CONTEXT_KEY, {
        vo: task,
        events: events,
        eventProgress,
        comments: comments,
        projects: computed(() => [...projects.value.values()]),
        tags,
        isCommenting,
        emit,
        closeDetails,
        resortEvents: (oeid, teid, isUp) => eventUseCase.resort(oeid, teid, isUp),
        eventHandler,
        commentHandler,
        taskHandler,
        eventsLoading,
        eventsError,
        commentsLoading,
        commentsError,
        dialogManager,
        retryEvents,
        retryComments,
        switchTaskDetails,
        makeEventToTask
    })

    // @returns 返回值
    return { loading, error, task, closeDetails }
}

export default useTaskDetails

