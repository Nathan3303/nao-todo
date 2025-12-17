import {
    createCommentRes2CommentEntity,
    getCommentRes2CommentEntity,
    listCommentRes2CommentEntities
} from './converters'
import { CommentEntity } from '@nao-todo/domain/comment/entities'
import type { CommentRepository } from '@nao-todo/domain/comment/repositories'
import type { Requester } from '../../requester/types'
import type { Err, GoLike } from '@nao-todo/types'
import type {
    CreateCommentReq,
    CreateCommentRes,
    GetCommentRes,
    ListCommentRes,
    ResponseData,
    UpdateCommentReq,
    UpdateCommentRes
} from '../types'

export const useCommentRepository = (requester: Requester): CommentRepository => {
    const get = async (commentId: string): Promise<GoLike<CommentEntity | null>> => {
        // 1. 调用接口
        const response = await requester.get(`/comments/${commentId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 60000) {
            return [null, res.message]
        }
        // 3. 转换为实体
        const commentEntity = getCommentRes2CommentEntity(res.data as GetCommentRes)
        // 4. 返回
        return [commentEntity, null]
    }
    const create = async (commentEntity: CommentEntity): Promise<GoLike<CommentEntity | null>> => {
        // 1. 构建 rto
        const rto: CreateCommentReq = {
            taskId: commentEntity.taskId,
            content: commentEntity.content
        }
        // 2. 调用接口
        const response = await requester.post('/comments', {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` },
            data: rto
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 60010) {
            return [null, res.message]
        }
        // 4. 转换为实体
        commentEntity = createCommentRes2CommentEntity(res.data as CreateCommentRes)
        // 5. 返回
        return [commentEntity, null]
    }

    const update = async (
        commentId: string,
        commentEntity: CommentEntity
    ): Promise<GoLike<string | null>> => {
        // 1. 构建 rto
        const rto: UpdateCommentReq = {}
        if (commentEntity.content) rto.content = commentEntity.content
        if (commentEntity.attachments) rto.attachments = commentEntity.attachments
        if (commentEntity.isTopUp) rto.isTopUp = commentEntity.isTopUp
        // 2. 调用接口
        const response = await requester.put(`/comments/${commentId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` },
            data: rto
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 60020) {
            return [null, res.message]
        }
        // 4. 返回
        const data = res.data as UpdateCommentRes
        return [data.commentId, null]
    }

    const remove = async (commentId: string): Promise<Err> => {
        // 1. 调用接口
        const response = await requester.delete(`/comments/${commentId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 60030) {
            return res.message
        }
        // 3. 返回
        return null
    }

    const list = async (): Promise<GoLike<CommentEntity[] | null>> => {
        // 1. 调用接口
        const response = await requester.get('/comments/', {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 获取结果
        const res = response.data as ResponseData
        if (res.code !== 60040) {
            return [null, res.message]
        }
        // 3. 转换为实体
        const commentEntities = listCommentRes2CommentEntities(res.data as ListCommentRes)
        // 4. 返回
        return [commentEntities, null]
    }

    return { create, get, update, remove, list }
}
