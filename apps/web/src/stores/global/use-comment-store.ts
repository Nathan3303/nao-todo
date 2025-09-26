import { defineStore } from 'pinia'
import { ref } from 'vue'
import { unwrapError } from '@nao-todo/utils'
import { requester } from './requester'
import {
    createCommentHandler,
    deleteCommentHandler,
    getCommentsHandler,
    updateCommentHandler
} from '@nao-todo/handlers/v1'
import type {
    CreateCommentOptions,
    Err,
    GetCommentsOptions,
    Comment,
    ResponseData,
    UpdateCommentOptions
} from '@nao-todo/types'

const useCommentStore = defineStore('CommentStore', () => {
    // @state 评论列表（应该被应用于整个视图）
    const comments = ref<Comment[]>([])
    const pagination = ref<ResponseData['pagination']>({ total: 0, page: 1, limit: 10, maxPage: 1 })

    // @method 进一步筛选评论列表
    const getComments = async (options: GetCommentsOptions): Promise<Err> => {
        // 获取评论列表
        const [res, err] = await getCommentsHandler(options, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        if (res) {
            comments.value = res.comments || []
            pagination.value = res.pagination
        }
        return null
    }

    // @method 创建评论
    const createComment = async (options: CreateCommentOptions): Promise<Err> => {
        // 参数判断
        if (!options.content) return '评论内容不能为空'
        // 创建评论
        const [res, err] = await createCommentHandler(options, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        comments.value.push(res)
        return null
    }

    // @method 更新评论
    const updateComment = async (
        commentId: Comment['id'],
        options: UpdateCommentOptions
    ): Promise<Err> => {
        // 参数判断
        if (!commentId) return '评论ID不能为空'
        // 更新评论
        const [, err] = await updateCommentHandler(commentId, options, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        comments.value.forEach((comment) => {
            if (comment.id === commentId) {
                if (options.content) comment.content = options.content
                if (options.isTopUp) comment.isTopUp = options.isTopUp
            }
        })
        return null
    }

    // @method 删除评论
    const deleteComment = async (commentId: Comment['id']): Promise<Err> => {
        // 参数判断
        if (!commentId) return '评论ID不能为空'
        // 删除评论
        const [, err] = await deleteCommentHandler(commentId, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        comments.value = comments.value.filter((comment) => comment.id !== commentId)
        return null
    }

    return {
        comments,
        pagination,
        getComments,
        createComment,
        updateComment,
        deleteComment
    }
})

export default useCommentStore
