import { createTagRes2TagEntity, getTagRes2TagEntity, listTagRes2TagEntities } from './converters'
import { TagEntity } from '@nao-todo/domain/tag/entities'
import type { TagRepository } from '@nao-todo/domain/tag/repositories'
import type { Requester } from '../../requester/types'
import type { Err, GoLike } from '@nao-todo/types'
import type {
    CreateTagReq,
    CreateTagRes,
    GetTagRes,
    ListTagRes,
    ResponseData,
    UpdateTagReq,
    UpdateTagRes
} from '../types'

export const useTagRepository = (requester: Requester): TagRepository => {
    const get = async (tagId: string): Promise<GoLike<TagEntity | null>> => {
        // 1. 调用接口
        const response = await requester.get(`/tags/${tagId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 30000) {
            return [null, res.message]
        }
        // 3. 转换为实体
        const tagEntity = getTagRes2TagEntity(res.data as GetTagRes)
        // 4. 返回
        return [tagEntity, null]
    }
    const create = async (tagEntity: TagEntity): Promise<GoLike<TagEntity | null>> => {
        // 1. 构建 rto
        const rto: CreateTagReq = {
            name: tagEntity.name,
            description: tagEntity.description,
            color: tagEntity.color
        }
        // 2. 调用接口
        const response = await requester.post('/tags', {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` },
            data: rto
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 30010) {
            return [null, res.message]
        }
        // 4. 转换为实体
        tagEntity = createTagRes2TagEntity(res.data as CreateTagRes)
        // 5. 返回
        return [tagEntity, null]
    }

    const update = async (tagId: string, tagEntity: TagEntity): Promise<GoLike<string | null>> => {
        // 1. 构建 rto
        const rto: UpdateTagReq = {}
        if (tagEntity.name) rto.name = tagEntity.name
        if (tagEntity.description) rto.description = tagEntity.description
        // 2. 调用接口
        const response = await requester.put(`/tags/${tagId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` },
            data: rto
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 30020) {
            return [null, res.message]
        }
        // 4. 返回
        const data = res.data as UpdateTagRes
        return [data.tagId, null]
    }

    const remove = async (tagId: string): Promise<Err> => {
        // 1. 调用接口
        const response = await requester.delete(`/tags/${tagId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 30030) {
            return res.message
        }
        // 3. 返回
        return null
    }

    const list = async (): Promise<GoLike<TagEntity[] | null>> => {
        // 1. 调用接口
        const response = await requester.get('/tags/', {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 获取结果
        const res = response.data as ResponseData
        if (res.code !== 30040) {
            return [null, res.message]
        }
        // 3. 转换为实体
        const tagEntities = listTagRes2TagEntities(res.data as ListTagRes)
        // 4. 返回
        return [tagEntities, null]
    }

    return { create, get, update, remove, list }
}
