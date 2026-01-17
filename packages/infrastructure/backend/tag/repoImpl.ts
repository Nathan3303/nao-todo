import {
    createTagRes2TagEntity,
    getTagPreferenceRes2TagPreferenceEntity,
    getTagRes2TagEntity,
    listTagRes2TagEntities,
    tagPreferenceEntity2UpdateReq
} from './converters'
import type { TagEntity, TagPreferenceEntity } from '@nao-todo/domain/tag/entities'
import type { TagRepository } from '@nao-todo/domain/tag/repositories'
import type { Requester } from '../../requester/types'
import type { CreateTagVO, Err, GoAsync, UpdateTagVO } from '@nao-todo/types'
import type {
    CreateTagReq,
    CreateTagRes,
    GetTagPreferenceRes,
    GetTagRes,
    ListTagRes,
    ResponseData,
    UpdateTagPreferenceRes,
    UpdateTagReq,
    UpdateTagRes
} from '../types'
import { defaultPreference } from '../../consts/preference'

export const useTagRepository = (requester: Requester): TagRepository => {
    const get = async (tagId: string): GoAsync<TagEntity> => {
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
    const create = async (createVO: CreateTagVO): GoAsync<TagEntity | null> => {
        // 1. 构建 rto
        const rto: CreateTagReq = {
            name: createVO.name,
            description: createVO.description || '',
            color: createVO.color || 'transparent'
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
        const tagEntity = createTagRes2TagEntity(res.data as CreateTagRes)
        // 5. 返回
        return [tagEntity, null]
    }

    const update = async (tagId: string, updateVO: UpdateTagVO): GoAsync<void> => {
        // 1. 构建 rto
        const rto: UpdateTagReq = {}
        if (updateVO.name) rto.name = updateVO.name
        if (updateVO.description) rto.description = updateVO.description
        if (updateVO.color) rto.color = updateVO.color
        // 2. 调用接口
        const response = await requester.put(`/tags/${tagId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` },
            data: rto
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 30020) {
            return res.message
        }
        // 4. 返回
        const data = res.data as UpdateTagRes
        return data.tagId
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

    const list = async (): GoAsync<TagEntity[]> => {
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

    const getPreference = async (tagId: string): GoAsync<TagPreferenceEntity> => {
        // 1. 调用接口
        const response = await requester.get(`/tags/${tagId}/preference`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 获取
        const res = response.data as ResponseData
        // 3. 判断结果
        if (res.code === 30050) {
            return [getTagPreferenceRes2TagPreferenceEntity(res.data as GetTagPreferenceRes), null]
        }
        // 4. 失败返回默认值
        return [defaultPreference, null]
    }

    const updatePreference = async (
        tagId: string,
        preferenceEntity: TagPreferenceEntity
    ): GoAsync<string> => {
        // 1. 构建 rto
        const rto = tagPreferenceEntity2UpdateReq(preferenceEntity)
        // 1. 调用接口
        const response = await requester.post(`/tags/${tagId}/preference`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` },
            data: rto
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 30060) {
            return [null, res.message]
        }
        // 3. 返回
        const data = res.data as UpdateTagPreferenceRes
        return [data.tagId, null]
    }

    return { create, get, update, remove, list, getPreference, updatePreference }
}
