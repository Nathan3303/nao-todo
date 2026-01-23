import { ref } from 'vue'
import type { Comment } from '@nao-todo/types'

const useCommentsStoreBase = () => {
    // @state 评论 Map
    const commentMap = ref<Map<Comment['id'], Comment>>(new Map())

    // @method 设置评论(s)
    const setComments = (comments: Comment[]) => {
        commentMap.value = new Map(comments.map((comment) => [comment.id, comment]))
    }

    // @method 获取单个评论
    const getComment = (commentId: Comment['id']) => {
        return commentMap.value.get(commentId)
    }

    // @method 添加评论
    const addComment = (comment: Comment) => {
        commentMap.value.set(comment.id, comment)
    }

    // @returns
    return {
        setComments,
        getComment,
        addComment
    }
}

export default useCommentsStoreBase
export type CommentsStoreBase = ReturnType<typeof useCommentsStoreBase>
