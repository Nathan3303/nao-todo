import {
    createCommentRes2CommentEntity,
    getCommentRes2CommentEntity,
    listCommentRes2CommentEntities
} from './converters'
import type { Requester } from '../../requester/types'
import type { GoAsync } from '@nao-todo/types'
import type {
    CreateCommentReq,
    CreateCommentRes,
    GetCommentRes,
    ListCommentRes,
    ResponseData,
    UpdateCommentReq,
    UpdateCommentRes
} from '../types'
import {
    CreateCommentValueObject,
    UpdateCommentValueObject,
    type CommentEntity,
    type CommentRepository
} from '@nao-todo/domain/comment'

export const useCommentRepository = (requester: Requester): CommentRepository => {
    // @method Get
    const get = async (commentId: string): GoAsync<CommentEntity> => {
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

    // @method Create
    const create = async (
        createCommentValueObject: CreateCommentValueObject
    ): GoAsync<CommentEntity> => {
        // 1. 构建 rto
        const rto: CreateCommentReq = {
            taskId: createCommentValueObject.taskId,
            content: createCommentValueObject.content
        }
        // 2. 调用接口
        const response = await requester.post('/comments/', rto, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 60010) {
            return [null, res.message]
        }
        // 4. 转换为实体
        const commentEntity = createCommentRes2CommentEntity(res.data as CreateCommentRes)
        // 5. 返回
        return [commentEntity, null]
    }

    // @method Update
    const update = async (
        commentId: string,
        updateValueObject: UpdateCommentValueObject
    ): GoAsync<string> => {
        // 1. 构建 rto
        const rto: UpdateCommentReq = {}
        if (updateValueObject.content) rto.content = updateValueObject.content
        if (typeof updateValueObject.isTopUp === 'boolean') rto.isTopUp = updateValueObject.isTopUp
        // 2. 调用接口
        const response = await requester.put(`/comments/${commentId}`, rto, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 60020) {
            return [null, res.message]
        }
        // 4. 返回
        return [res.data as UpdateCommentRes, null]
    }

    // @method Remove
    const remove = async (commentId: string): GoAsync<void> => {
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

    // @method List
    const list = async (taskId: string): GoAsync<CommentEntity[]> => {
        // 1. 调用接口
        const response = await requester.get(`/comments/?taskId=${taskId}`, {
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

