import { type Subscriber, unwrapError } from '@nao-todo/shared'
import { storeToRefs } from 'pinia'
import { inject, ref } from 'vue'
import { TaskCommentHandler } from '../../handlers'
import type { useTaskDetailsStore } from '../../stores'
import type { TaskViewObject } from '../../types'
import { TASK_DETAILS_PRE_CONTEXT_KEY } from './context'

type TaskDetailsStore = ReturnType<typeof useTaskDetailsStore>

/**
 * 评论 composable
 * @description 管理任务评论的用例、处理程序、加载/重试及评论中状态。
 * @param taskDetailsStore 任务详情存储
 * @param subscriber 订阅器
 */
const useComments = (taskDetailsStore: TaskDetailsStore, subscriber: Subscriber) => {
    // @context 任务详情上下文
    const { taskCommentUseCase } = inject(TASK_DETAILS_PRE_CONTEXT_KEY)!

    // @handler 任务评论处理程序
    const commentHandler = new TaskCommentHandler(taskCommentUseCase, subscriber)

    // @presetStates
    const {
        commentIdsComments: comments,
        commentsLoading,
        commentsError
    } = storeToRefs(taskDetailsStore)

    // @state 是否正在评论
    const isCommenting = ref(false)

    // @state 当前任务 ID
    let currentTaskId: TaskViewObject['id'] | null = null

    /**
     * 加载评论
     * @param taskId 任务 ID
     */
    const loadComments = async (taskId: TaskViewObject['id']) => {
        currentTaskId = taskId
        taskDetailsStore.setCommentsLoading(true)
        taskDetailsStore.setCommentsError('')
        const [, err] = await taskCommentUseCase.list(taskId)
        if (err !== null) {
            taskDetailsStore.setCommentsError('评论获取失败：' + unwrapError(err))
        }
        taskDetailsStore.setCommentsLoading(false)
    }

    /**
     * 重试加载评论
     */
    const retryComments = async () => {
        if (!currentTaskId) return
        await loadComments(currentTaskId)
    }

    // @returns
    return {
        commentHandler,
        comments,
        commentsLoading,
        commentsError,
        isCommenting,
        loadComments,
        retryComments
    }
}

export default useComments
