import { computed, ref } from 'vue'
import type { CommentsStoreBase } from './comments-store-base'
import type { CommentViewObject } from '@nao-todo/types'
import dayjs from 'dayjs'

const useCommentIdsStoreBase = (getComment: CommentsStoreBase['getComment']) => {
    // @state 评论 ID 数组
    const commentIds = ref<CommentViewObject['id'][]>([])

    // @state 评论数组 - 用于展示
    const comments = computed(() => {
        const _comments = commentIds.value.map((id) => getComment(id)!).filter(Boolean)
        if (_comments.length === 0) return []
        return _comments.sort((a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix())
    })

    // @method 设置评论 ID 数组
    const setCommentIds = (newCommentIds: CommentViewObject['id'][]) => {
        commentIds.value = newCommentIds
    }

    // @method 添加评论 ID
    const addCommentId = (newCommentId: CommentViewObject['id']) => {
        // 检查是否已存在
        if (commentIds.value.includes(newCommentId)) {
            return
        }
        commentIds.value.push(newCommentId)
    }

    // @method 删除评论 ID
    const removeCommentId = (commentId: CommentViewObject['id']) => {
        commentIds.value = commentIds.value.filter((id) => id !== commentId)
    }

    // @return
    return {
        commentIds,
        comments,
        setCommentIds,
        addCommentId,
        removeCommentId
    }
}

export default useCommentIdsStoreBase
export type CommentIdsStoreBase = ReturnType<typeof useCommentIdsStoreBase>
