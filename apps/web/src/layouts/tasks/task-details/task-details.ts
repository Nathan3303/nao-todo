import dayjs from 'dayjs'
import { computed, inject, provide, ref, watch } from 'vue'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { TASK_DETAILS_CONTEXT_KEY } from './constants'
import type { Comment, UpdateComment } from '@nao-todo/types/viewobjects/comment'
import { type TaskDetailsProps, type TaskDetailsEmits, type TaskDetailsContext } from './types'
import type { Event, Task } from '@nao-todo/types'
import { EventUseCase } from '@nao-todo/application/web/usecases/event'
import { EventDomain } from '@nao-todo/domain/event'
import { useEventRepository } from '@nao-todo/infrastructure/backend/event/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { CommentUseCase } from '@nao-todo/application/web/usecases/comment'
import { CommentDomain } from '@nao-todo/domain/comment'
import { useCommentRepository } from '@nao-todo/infrastructure/backend/comment/repoImpl'
import { storeToRefs } from 'pinia'
import { useProjectsStore, useTagsStore, useTasksStore, useTaskDetailsStore } from '@/stores/tasks'
import type { TasksViewContext } from '@/views/index/tasks/tasks-view'
import { TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'

export default (props: TaskDetailsProps, emit: TaskDetailsEmits) => {
    // @viewContext TasksView context
    const tasksViewContext = inject<TasksViewContext>(TASKS_VIEW_CONTEXT_KEY)!

    // @dataStore
    const projectStore = useProjectsStore()
    const tagStore = useTagsStore()
    const taskStore = useTasksStore()
    const taskDetailsStore = useTaskDetailsStore()

    // @presetStates
    const { projects } = storeToRefs(projectStore)

    // @usecase 任务检查事项用例
    const eventUseCase = new EventUseCase(
        new EventDomain(useEventRepository(getRequesterImpl())),
        taskDetailsStore
    )

    // @usecase 任务评论用例
    const commentUseCase = new CommentUseCase(
        new CommentDomain(useCommentRepository(getRequesterImpl())),
        taskDetailsStore
    )

    // @states
    const loading = ref(false)
    const error = ref('')
    const eventIds = ref<Event['id'][]>([])
    const commentIds = ref<Comment['id'][]>([])
    const isCommenting = ref(false)

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
            startAt: dayjs(_task.startAt).format('YYYY-MM-DD HH:mm'),
            endAt: dayjs(_task.endAt).format('YYYY-MM-DD HH:mm'),
            deletedAt: _task.deletedAt,
            isDeleted: _task.isDeleted || _task.deletedAt === null,
            isFavorited: _task.isFavorited,
            isGivenUp: _task.isGivenUp,
            isDone: _task.state === 'done',
            createdAt: dayjs(_task.createdAt).format('YYYY-MM-DD HH:mm'),
            updatedAt: dayjs(_task.updatedAt).format('YYYY-MM-DD HH:mm')
        }
    })

    // @computed 获取检查事项列表
    const events = computed(() => {
        if (!props.taskId) return []
        const _events = eventIds.value.map((id) => taskDetailsStore.getEvent(id)!).filter(Boolean)
        return _events.sort((a, b) => a.sortId - b.sortId)
    })

    // @computed 获取评论列表
    const comments = computed(() => {
        if (!props.taskId) return []
        return commentIds.value.map((id) => taskDetailsStore.getComment(id)!).filter(Boolean)
    })

    // @method 初始化任务详情
    const initialize = async (taskId?: Task['id']) => {
        // 1. 判断任务 ID
        if (!taskId) {
            error.value = '选择任务以查看详情'
            return
        }
        // 2. 获取检查事项
        const [eids, err] = await eventUseCase.loadEvents(taskId)
        if (err !== null) {
            error.value = '检查事项获取失败：' + unwrapError(err)
            return
        }
        eventIds.value = eids
        // 3. 获取评论
        const [cids, err2] = await commentUseCase.loadComments(taskId)
        if (err2 !== null) {
            error.value = '评论获取失败：' + unwrapError(err2)
            return
        }
        commentIds.value = cids
        return null
    }

    // @watch 监听任务 ID
    watch(
        () => props.taskId,
        async (newId) => await initialize(newId),
        { immediate: true }
    )

    // @computed 计算检查事项进度
    const eventProgress = computed(() => {
        const _e = events.value
        const progress = _e ? _e.filter((event) => event.isDone).length : 0
        const total = _e ? _e.length : 0
        const percentage = total ? Math.floor((progress / total) * 100) : 0
        const text = total ? `已完成 ${progress}/${total}, ${percentage}%` : '待办目前无检查事项'
        return { percentage, text }
    })

    // @method 重新排序检查事项
    const resortEvents = async (origin: number, target: number, isUp: boolean) => {
        if (!events.value) return
        const originEvent = events.value[origin]
        const targetEvent = events.value[target]
        if (!originEvent || !targetEvent) return
        // 处理上升排序
        if (isUp) {
            if (originEvent.sortId >= targetEvent.sortId) {
                originEvent.sortId = targetEvent.sortId - 1
            }
        } else {
            if (originEvent.sortId <= targetEvent.sortId) {
                originEvent.sortId = targetEvent.sortId + 1
            }
        }
        // 更新检查事项排序
        emit('updateEvents', [
            { eventId: originEvent.id, updateVO: { sortId: originEvent.sortId } },
            { eventId: targetEvent.id, updateVO: { sortId: targetEvent.sortId } }
        ])
    }

    // @method 更新评论
    const updateComment = async (commentId: Comment['id'], updateVO: UpdateComment) => {
        if (!comments.value) return
        const index = comments.value.findIndex((comment) => comment.id === commentId)
        if (index === -1) return
        comments.value[index] = {
            ...comments.value[index],
            ...updateVO,
            id: comments.value[index].id,
            taskId: comments.value[index].taskId
        }
        emit('updateComment', commentId, updateVO)
    }

    // @method 删除评论
    const deleteComment = (commentId: Comment['id']) => {
        if (!comments.value) return
        const index = comments.value.findIndex((comment) => comment.id === commentId)
        if (index === -1) return
        comments.value.splice(index, 1)
        emit('deleteComment', commentId)
    }

    // @method 设置任务为已完成
    const finishTask = () => {
        if (!task.value) return
        const taskId = task.value?.id
        if (!taskId) return
        task.value.state = 'done'
        emit('updateTask', taskId, task.value)
    }

    // @method 更新任务结束时间
    const updateEndAt = (value: string) => {
        if (!task.value) return
        task.value.endAt = value
        emit('updateTask', task.value.id, task.value)
    }

    // @provide 任务详情面板上下文
    provide<TaskDetailsContext>(TASK_DETAILS_CONTEXT_KEY, {
        vo: task,
        events: events,
        eventProgress,
        comments: comments,
        projects: computed(() => [...projects.value.values()]),
        isCommenting,
        emit,
        finishTask,
        closeDetails: () => emit('closeDetails'),
        updateEndAt,
        resortEvents,
        updateComment,
        deleteComment
    })

    // @returns 返回值
    return { loading, error, task }
}
