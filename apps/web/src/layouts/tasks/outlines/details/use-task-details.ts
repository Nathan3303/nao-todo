import dayjs from 'dayjs'
import { computed, provide, ref, watch } from 'vue'
import { unwrapError } from '@nao-todo/utils'
import { TASK_DETAILS_CONTEXT_KEY } from './constants'
import type { CommentVO, UpdateCommentVO } from '@nao-todo/types/viewobjects/comment'
import type { TaskDetailsProps, TaskDetailsEmits, TaskDetailsVO, TaskDetailsContext } from './types'
import type { EventVO, Go, GoAsync, TaskVO, WithNull } from '@nao-todo/types'

export default (props: TaskDetailsProps, emit: TaskDetailsEmits) => {
    // @states
    const loading = ref(false)
    const error = ref('')
    const taskVO = ref<WithNull<TaskVO>>(null)
    const taskDetailsVO = ref<WithNull<TaskDetailsVO>>(null)
    const eventVOList = ref<WithNull<EventVO[]>>(null)
    const commentVOList = ref<WithNull<CommentVO[]>>(null)
    const isCommenting = ref(false)

    // @method 格式转换
    const taskVO2TaskDetailsVO = (task: WithNull<TaskVO>): WithNull<TaskDetailsVO> => {
        if (task === null) return null
        return {
            id: task.id,
            projectId: task.projectId,
            projectName: props.projectNameGetter(task.projectId),
            name: task.name,
            description: task.description,
            state: task.state,
            priority: task.priority,
            tags: task.tags,
            tagList: props.tagGetter(task.tags),
            startAt: dayjs(task.startAt).format('YYYY-MM-DD HH:mm'),
            endAt: dayjs(task.endAt).format('YYYY-MM-DD HH:mm'),
            deletedAt: task.deletedAt,
            isDeleted: task.isDeleted || task.deletedAt === null,
            isFavorited: task.isFavorited,
            isGivenUp: task.isGivenUp,
            isDone: task.state === 'done',
            createdAt: dayjs(task.createdAt).format('YYYY-MM-DD HH:mm'),
            updatedAt: dayjs(task.updatedAt).format('YYYY-MM-DD HH:mm')
        }
    }

    // @method 获取任务详情
    const fetchTaskById = (taskId: TaskVO['id']): Go<void> => {
        // 1. 参数校验
        if (!taskId) {
            return '参数错误'
        }
        // 2. 调用请求器
        const task = props.taskGetter(taskId)
        if (!task) {
            return '任务获取失败'
        }
        taskVO.value = task
        return null
    }

    // @method 获取检查事项列表
    const fetchEventsByTaskId = async (taskId: TaskVO['id']): GoAsync<void> => {
        // 1. 参数校验
        if (!taskId) {
            return '参数错误'
        }
        // 2. 调用请求器
        const [events, err] = await props.eventLister(taskId)
        if (err !== null) {
            return '检查事项获取失败：' + unwrapError(err)
        }
        // 3. 排序
        eventVOList.value = sortEvents(events)
        return null
    }

    // @method 获取评论列表
    const fetchCommentsByTaskId = async (taskId: TaskVO['id']): GoAsync<void> => {
        // 1. 参数校验
        if (!taskId) {
            return '参数错误'
        }
        // 2. 调用请求器
        const [comments, err] = await props.commentLister(taskId)
        if (err !== null) {
            return '评论获取失败：' + unwrapError(err)
        }
        commentVOList.value = comments
        return null
    }

    // @watch 监听任务 ID
    watch(
        () => props.taskId,
        async (newId) => {
            if (!newId) {
                error.value = '选择任务以查看详情'
                return
            }
            loading.value = true
            const fetchTaskError = fetchTaskById(newId)
            if (fetchTaskError !== null) {
                error.value = unwrapError(fetchTaskError)
                loading.value = false
                return
            }
            const fetchEventsError = await fetchEventsByTaskId(newId)
            if (fetchEventsError !== null) {
                error.value = unwrapError(fetchEventsError)
                loading.value = false
                return
            }
            const fetchCommentsError = await fetchCommentsByTaskId(newId)
            if (fetchCommentsError !== null) {
                error.value = unwrapError(fetchCommentsError)
                loading.value = false
                return
            }
            error.value = ''
            loading.value = false
            // console.log(eventVOList.value, commentVOList.value)
        },
        { immediate: true }
    )

    // @watch 监听任务详情变化，构建任务详情视图对象
    watch(
        () => taskVO.value,
        (newVO) => (taskDetailsVO.value = taskVO2TaskDetailsVO(newVO)),
        { immediate: true }
    )

    // @method 设置任务为已完成
    const finishTask = () => {
        if (!taskVO.value) return
        const taskId = taskVO.value?.id
        if (!taskId) return
        taskVO.value.state = 'done'
        emit('updateTask', taskId, taskVO.value)
    }

    // @method 更新任务结束时间
    const updateEndAt = (value: string | null) => {
        if (!taskVO.value) return
        taskVO.value.endAt = value
        emit('updateTask', taskVO.value.id, taskVO.value)
    }

    // @computed 计算检查事项进度
    const eventProgress = computed(() => {
        const _e = eventVOList.value
        const progress = _e ? _e.filter((event) => event.isDone).length : 0
        const total = _e ? _e.length : 0
        const percentage = total ? Math.floor((progress / total) * 100) : 0
        const text = total ? `已完成 ${progress}/${total}, ${percentage}%` : '待办目前无检查事项'
        return { percentage, text }
    })

    // @method 排序检查事项
    const sortEvents = (events: EventVO[]) => {
        return events.sort((a, b) => a.sortId - b.sortId)
    }

    // @method 重新排序检查事项
    const resortEvents = async (origin: number, target: number, isUp: boolean) => {
        if (!eventVOList.value) return
        const originEvent = eventVOList.value[origin]
        const targetEvent = eventVOList.value[target]
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
        // 重新排序检查事项
        eventVOList.value = sortEvents(eventVOList.value)
    }

    // @method 更新评论
    const updateComment = async (commentId: CommentVO['id'], updateVO: UpdateCommentVO) => {
        if (!commentVOList.value) return
        const index = commentVOList.value.findIndex((comment) => comment.id === commentId)
        if (index === -1) return
        commentVOList.value[index] = {
            ...commentVOList.value[index],
            ...updateVO,
            id: commentVOList.value[index].id,
            taskId: commentVOList.value[index].taskId
        }
        emit('updateComment', commentId, updateVO)
    }

    // @method 删除评论
    const deleteComment = (commentId: CommentVO['id']) => {
        if (!commentVOList.value) return
        const index = commentVOList.value.findIndex((comment) => comment.id === commentId)
        if (index === -1) return
        commentVOList.value.splice(index, 1)
        emit('deleteComment', commentId)
    }

    // @provide 任务详情面板上下文
    provide<TaskDetailsContext>(TASK_DETAILS_CONTEXT_KEY, {
        vo: taskDetailsVO,
        events: eventVOList,
        eventProgress,
        comments: commentVOList,
        projects: computed(() => props.projects || []),
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
    return { loading, error, taskDetailsVO }
}
