import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useUserStore } from './use-user-store'
import { createComment, deleteComment, getComments, updateComment } from '@nao-todo/apis'
import type {
    CreateCommentOptions,
    Comment,
    GetCommentsOptions,
    UpdateCommentOptions,
    UpdateCommentOptionsRaw
} from '@nao-todo/types'

export const useCommentStore = defineStore('commentStore', () => {
    const comments = ref<Comment[]>([])
    const userStore = useUserStore()

    // 获取选项
    const getOptions = ref<GetCommentsOptions>({})

    // 创建检查事项
    const doCreateComment = async (options: CreateCommentOptions) => {
        const result = await createComment(options)
        if (result.code !== 20000) return false
        const newComment = result.data as Comment
        newComment.user = userStore.user!
        comments.value.push(newComment)
        return true
    }

    // 更新检查事项
    const doUpdateComment = async (commentId: Comment['id'], options: UpdateCommentOptions) => {
        const result = await updateComment(commentId, options)
        if (result.code !== 20000) return false
        const index = comments.value.findIndex((comment) => comment.id === commentId)
        if (index === -1) return false
        Object.keys(comments.value[index]).forEach((key) => {
            if (key in options) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                comments.value[index][key] = options[key as keyof UpdateCommentOptionsRaw]
            }
        })
        return true
    }

    // 获取检查事项
    const doGetComments = async () => {
        const result = await getComments(getOptions.value)
        if (result.code !== 20000) return false
        comments.value = result.data as Comment[]
        return true
    }

    // 删除检查事项
    const doDeleteComment = async (commentId: Comment['id']) => {
        const result = await deleteComment(commentId)
        if (result.code !== 20000) return false
        comments.value = comments.value.filter((comment) => comment.id !== commentId)
        return true
    }

    return {
        comments,
        getOptions,
        doCreateComment,
        doUpdateComment,
        doDeleteComment,
        doGetComments
    }
})
