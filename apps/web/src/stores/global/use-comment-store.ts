import { defineStore } from 'pinia'
import { ref } from 'vue'
import { unwrapError } from '@nao-todo/utils'
import { requester } from './requester'
import type {
    CreateCommentOptions,
    Err,
    GetCommentsOptions,
    Comment,
    ResponseData
} from '@nao-todo/types'
import { createCommentHandler, getCommentsHandler } from '@nao-todo/handlers/v1'

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
            comments.value = res.comments
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

    // @method 删除评论
    // const deleteProject = async (projectId: Project['id']): Promise<Err> => {
    //     // 参数判断
    //     if (!projectId) return '评论ID不能为空'
    //     // 删除评论
    //     const [, err] = await deleteProjectHandler(projectId)
    //     // 处理失败结果
    //     if (err) {
    //         console.error(unwrapError(err))
    //         return err
    //     }
    //     // 处理成功结果
    //     // projects.value = projects.value.filter((project) => project.id !== projectId)
    //     projects.value.forEach((project) => {
    //         if (project.id === projectId) {
    //             project.isDeleted = true
    //         }
    //     })
    //     return null
    // }

    // @method 删除评论（带确认）
    // const deleteProjectWithConfirm = async (projectId: Project['id']): Promise<Err> => {
    //     return (await NueConfirm({
    //         title: '删除评论',
    //         content: '确定要删除此评论吗？',
    //         confirmButtonText: '删除',
    //         cancelButtonText: '取消',
    //         onConfirm: async () => {
    //             const err = await deleteProject(projectId)
    //             if (err) {
    //                 NueMessage.error(unwrapError(err))
    //                 return err
    //             }
    //             NueMessage.success('删除成功')
    //             return 'ok'
    //         }
    //     })) as Err
    // }

    return {
        comments,
        pagination,
        getComments,
        createComment
    }
})

export default useCommentStore
