import { computed, ref } from 'vue'
import type { Comment, UpdateComment } from '@nao-todo/types'

const useCommentsStoreBase = () => {
    // @state 评论数组
    const comments = ref<Comment[]>([])

    // @computed 评论 Map
    const commentMap = computed(
        () => new Map(comments.value.map((comment) => [comment.id, comment]))
    )

    // @method 设置评论(s)
    const setComments = (newComments: Comment[]) => {
        comments.value = newComments
    }

    // @method 获取单个评论
    const getComment = (commentId: Comment['id']) => {
        return commentMap.value.get(commentId)
    }

    // @method 添加评论
    const addComment = (comment: Comment) => {
        const idx = comments.value.findIndex((c) => c.id === comment.id)
        if (idx !== -1) return
        comments.value.push(comment)
    }

    // @method 更新评论
    const updateComment = (commentId: Comment['id'], updateComment: UpdateComment) => {
        const idx = comments.value.findIndex((c) => c.id === commentId)
        if (idx === -1) return
        comments.value[idx] = { ...comments.value[idx], ...updateComment }
    }

    // @method 删除评论
    const removeComment = (commentId: Comment['id']) => {
        const idx = comments.value.findIndex((c) => c.id === commentId)
        if (idx === -1) return
        comments.value.splice(idx, 1)
    }

    // @returns
    return {
        setComments,
        getComment,
        addComment,
        updateComment,
        removeComment
    }
}

export default useCommentsStoreBase
export type CommentsStoreBase = ReturnType<typeof useCommentsStoreBase>
