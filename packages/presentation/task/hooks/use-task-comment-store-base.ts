import { useListStoreBase, useMapperStoreBase } from '@nao-todo/shared'
import dayjs from 'dayjs'
import { computed } from 'vue'
import type { TaskCommentViewObject } from '@nao-todo/domain-task/viewobjects'
// import { env } from '@/infrastructure/constants/env'

export const useTaskCommentsStoreBase = () => {
    const {
        setList,
        getItem: getComment,
        addItem: addComment,
        patchItem: updateComment,
        removeItem: removeComment
    } = useMapperStoreBase<TaskCommentViewObject>()

    const setComments = (comments: TaskCommentViewObject[]) => {
        setList(
            comments.map((comment) => {
                // 处理评论头像路径
                return {
                    ...comment
                    // avatar:
                    //     comment.avatar.startsWith('https://') ||
                    //     comment.avatar.startsWith('http://')
                    //         ? comment.avatar
                    //         : env.baseURL + comment.avatar
                }
            })
        )
    }

    return {
        setComments,
        getComment,
        addComment,
        updateComment,
        removeComment
    }
}

export const useTaskCommentIdsStoreBase = (getComment: TaskCommentsStoreBase['getComment']) => {
    const {
        list: commentIds,
        setList: setCommentIds,
        addItem: addCommentId,
        removeItem: removeCommentId
    } = useListStoreBase<TaskCommentViewObject['id']>()

    // @state 评论数组 - 用于展示
    const comments = computed(() => {
        if (!commentIds.value) return []
        const _comments = commentIds.value.map((id) => getComment(id)!).filter(Boolean)
        if (_comments.length === 0) return []
        return _comments.sort((a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix())
    })

    // @return
    return {
        commentIds,
        comments,
        setCommentIds,
        addCommentId,
        removeCommentId
    }
}

export type TaskCommentsStoreBase = ReturnType<typeof useTaskCommentsStoreBase>
export type TaskCommentIdsStoreBase = ReturnType<typeof useTaskCommentIdsStoreBase>
