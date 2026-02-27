import type { CommentUseCase } from '@nao-todo/application/web/usecases/comment'
import { unwrapErrors } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { Comment, Task, UpdateComment } from '@nao-todo/types'
import { NueMessage } from 'nue-ui'

const useCommentHandler = (commentUseCase: CommentUseCase) => {
    // @method 创建评论
    const createComment = async (taskId: Task['id'], content: Comment['content']) => {
        if (!taskId) return false
        const [, err] = await commentUseCase.create({ taskId, content })
        if (err !== null) {
            NueMessage.error('评论创建失败' + `(${unwrapErrors(err)})`)
            return false
        }
        NueMessage.success('评论创建成功')
        return true
    }

    // @method 更新评论
    const updateComment = async (commentId: Comment['id'], updateComment: UpdateComment) => {
        if (!commentId) return
        const [, err] = await commentUseCase.update(commentId, updateComment)
        if (err !== null) {
            NueMessage.error('评论更新失败' + `(${unwrapErrors(err)})`)
            return
        }
        NueMessage.success('评论更新成功')
    }

    // @method 删除评论
    const deleteComment = async (commentId: Comment['id']) => {
        if (!commentId) return
        const [, err] = await commentUseCase.delete(commentId)
        if (err !== null) {
            NueMessage.error('评论删除失败' + `(${unwrapErrors(err)})`)
            return
        }
        NueMessage.success('评论删除成功')
    }

    // @return
    return {
        createComment,
        updateComment,
        deleteComment
    }
}

export default useCommentHandler
export type CommentHandler = ReturnType<typeof useCommentHandler>
