import type { CommentUseCase } from '@nao-todo/application/web/usecases/comment'
import { unwrapErrors } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { CommentViewObject, TaskViewObject, UpdateCommentViewObject } from '@nao-todo/types'
import { NueMessage } from 'nue-ui'
import { t } from '@nao-todo/infrastructure/locales'

const useCommentHandler = (commentUseCase: CommentUseCase) => {
    const createComment = async (
        taskId: TaskViewObject['id'],
        content: CommentViewObject['content']
    ) => {
        if (!taskId) return false
        const [, err] = await commentUseCase.create({ taskId, content })
        if (err !== null) {
            NueMessage.error(t('task.comment.createFailed', { error: `(${unwrapErrors(err)})` }))
            return false
        }
        NueMessage.success(t('task.comment.createSuccess'))
        return true
    }

    const updateComment = async (
        commentId: CommentViewObject['id'],
        updateComment: UpdateCommentViewObject
    ) => {
        if (!commentId) return
        const [, err] = await commentUseCase.update(commentId, updateComment)
        if (err !== null) {
            NueMessage.error(t('task.comment.updateFailed', { error: `(${unwrapErrors(err)})` }))
            return
        }
        NueMessage.success(t('task.comment.updateSuccess'))
    }

    const deleteComment = async (commentId: CommentViewObject['id']) => {
        if (!commentId) return
        const [, err] = await commentUseCase.delete(commentId)
        if (err !== null) {
            NueMessage.error(t('task.comment.deleteFailed', { error: `(${unwrapErrors(err)})` }))
            return
        }
        NueMessage.success(t('task.comment.deleteSuccess'))
    }

    return {
        createComment,
        updateComment,
        deleteComment
    }
}

export default useCommentHandler
export type CommentHandler = ReturnType<typeof useCommentHandler>
