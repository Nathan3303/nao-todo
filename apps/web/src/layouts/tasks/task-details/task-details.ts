import { computed, inject, provide, ref, watch } from 'vue'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { TASK_DETAILS_CONTEXT_KEY } from './constants'
import { EventUseCase } from '@nao-todo/application/web/usecases/event'
import { CommentUseCase } from '@nao-todo/application/web/usecases/comment'
import { storeToRefs } from 'pinia'
import { useProjectsStore, useTagsStore, useTasksStore, useTaskDetailsStore } from '@/stores/tasks'
import { TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import useCommentHandler from '@/infrastructure/handlers/tasks/comment-handler'
import useEventHandler from '@/infrastructure/handlers/tasks/event-handler'
import useTaskHandler from '@/infrastructure/handlers/tasks/task-handler'
import { useRouter } from 'vue-router'
import type { TaskViewObject } from '@nao-todo/types'
import type { TaskDetailsProps, TaskDetailsEmits, TaskDetailsContext } from './types'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'

const useTaskDetails = (props: TaskDetailsProps, emit: TaskDetailsEmits) => {
    // @viewContext TasksView context
    const tasksViewContext = inject<TasksViewContext>(TASKS_VIEW_CONTEXT_KEY)!
    const router = useRouter()

    // @dataStore
    const projectStore = useProjectsStore()
    const tagStore = useTagsStore()
    const taskStore = useTasksStore()
    const taskDetailsStore = useTaskDetailsStore()

    // @presetStates
    const { availableProjects: projects } = storeToRefs(projectStore)
    const { tags } = storeToRefs(tagStore)
    const {
        eventIdsEvents: events,
        commentIdsComments: comments,
        eventsLoading,
        eventsError,
        commentsLoading,
        commentsError
    } = storeToRefs(taskDetailsStore)

    // @usecase 任务检查事项用例
    const eventUseCase = EventUseCase.create(taskDetailsStore)

    // @usecase 任务评论用例
    const commentUseCase = CommentUseCase.create(taskDetailsStore)

    // @handlers
    const eventHandler = useEventHandler(eventUseCase)
    const commentHandler = useCommentHandler(commentUseCase)
    const taskHandler = useTaskHandler(tasksViewContext.taskUseCase)

    // @states
    const loading = ref(false)
    const error = ref('')
    const isCommenting = ref(false)
    const currentTaskId = ref<string | null>(null)

    // @computed 获取任务详情并转换为视图对象
    const task = computed(() => {
        if (!props.taskId) return null
        const _task = taskStore.getTask(props.taskId)
        if (!_task) return null
        return {
            id: _task.id,
            projectId: _task.projectId,
            projectName: tasksViewContext.getProjectName(_task.projectId),
            name: _task.name,
            description: _task.description,
            state: _task.state,
            priority: _task.priority,
            tags: _task.tags,
            tagList: _task.tags.map((tagId) => tagStore.getTag(tagId)!).filter(Boolean),
            startAt: _task.startAt,
            endAt: _task.endAt,
            deletedAt: _task.deletedAt,
            isDeleted: _task.isDeleted,
            isStarMarked: _task.isStarMarked,
            isGivenUp: _task.isGivenUp,
            isDone: _task.state === 'done',
            createdAt: _task.createdAt,
            updatedAt: _task.updatedAt,
            givenUpAt: _task.givenUpAt
        }
    })

    // @computed 计算检查事项进度
    const eventProgress = computed(() => {
        const _e = events.value
        const progress = _e ? _e.filter((event) => event.isDone).length : 0
        const total = _e ? _e.length : 0
        const percentage = total ? Math.floor((progress / total) * 100) : 0
        const text = total ? `已完成 ${progress}/${total}, ${percentage}%` : '暂无检查事项'
        return { percentage, text }
    })

    // @method 加载检查事项
    const loadEvents = async (taskId: TaskViewObject['id']) => {
        taskDetailsStore.setEventsLoading(true)
        taskDetailsStore.setEventsError('')
        const [, err] = await eventUseCase.loadEvents(taskId)
        if (err !== null) {
            taskDetailsStore.setEventsError('检查事项获取失败：' + unwrapError(err))
        }
        taskDetailsStore.setEventsLoading(false)
    }

    // @method 加载评论
    const loadComments = async (taskId: TaskViewObject['id']) => {
        taskDetailsStore.setCommentsLoading(true)
        taskDetailsStore.setCommentsError('')
        const [, err] = await commentUseCase.loadComments(taskId)
        if (err !== null) {
            taskDetailsStore.setCommentsError('评论获取失败：' + unwrapError(err))
        }
        taskDetailsStore.setCommentsLoading(false)
    }

    // @method 重试加载检查事项
    const retryEvents = async () => {
        if (!currentTaskId.value) return
        await loadEvents(currentTaskId.value)
    }

    // @method 重试加载评论
    const retryComments = async () => {
        if (!currentTaskId.value) return
        await loadComments(currentTaskId.value)
    }

    // @method 初始化任务详情
    const initialize = async (taskId?: TaskViewObject['id']) => {
        error.value = ''
        // 1. 判断任务 ID
        if (!taskId) {
            error.value = '选择任务以查看详情'
            return
        }
        currentTaskId.value = taskId
        // 2. 并行获取检查事项和评论
        await Promise.all([loadEvents(taskId), loadComments(taskId)])
        return null
    }

    // @method 关闭任务详情面板
    const closeDetails = () => {
        router.push({ name: router.currentRoute.value.name, params: { taskId: '' } })
    }

    // @watch 监听任务 ID
    watch(
        () => props.taskId,
        (newId) => initialize(newId),
        { immediate: true }
    )

    // @method 处理删除任务
    const handleDeleteTask = async (taskId: string) => {
        await taskHandler.deleteTask(taskId)
    }

    // @method 处理恢复任务
    const handleRestoreTask = async (taskId: string) => {
        await taskHandler.restoreTask(taskId)
    }

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
        retryEvents,
        retryComments
    })

    // @watch 监听任务删除事件
    watch(
        () => props.taskId,
        () => {},
        { immediate: false }
    )

    // @returns 返回值
    return {
        loading,
        error,
        task,
        handleDeleteTask,
        handleRestoreTask,
        closeDetails
    }
}

export default useTaskDetails

