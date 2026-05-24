import { computed, ref } from 'vue'
import type { CommentViewObject, UpdateCommentViewObject } from '@nao-todo/types'
import { env } from '@/infrastructure/constants/env'

const useCommentsStoreBase = () => {
    // @state 评论数组
    const comments = ref<CommentViewObject[]>([])

    // @computed 评论 Map
    const commentMap = computed(
        () => new Map(comments.value.map((comment) => [comment.id, comment]))
    )

    // @method 设置评论(s)
    const setComments = (newComments: CommentViewObject[]) => {
        comments.value = newComments.map((newComment) => {
            return {
                ...newComment,
                // 处理 avatar 链接
                user: {
                    avatar: `${env.baseURL}${newComment.user.avatar}?timestamp=${Date.now()}`,
                    nickname: newComment.user.nickname
                }
            }
        })
    }

    // @method 获取单个评论
    const getComment = (commentId: CommentViewObject['id']) => {
        return commentMap.value.get(commentId)
    }

    // @method 添加评论
    const addComment = (comment: CommentViewObject) => {
        const idx = comments.value.findIndex((c) => c.id === comment.id)
        if (idx !== -1) return
        comments.value.push(comment)
    }

    // @method 更新评论
    const updateComment = (
        commentId: CommentViewObject['id'],
        updateCommentViewObject: UpdateCommentViewObject
    ) => {
        const idx = comments.value.findIndex((c) => c.id === commentId)
        if (idx === -1) return
        comments.value[idx] = { ...comments.value[idx], ...updateCommentViewObject, id: commentId }
    }

    // @method 删除评论
    const removeComment = (commentId: CommentViewObject['id']) => {
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

