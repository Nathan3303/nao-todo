import {
    createTagRes2TagEntity,
    getTagPreferenceRes2TagPreferenceEntity,
    getTagRes2TagEntity,
    listTagRes2TagEntities,
    tagPreferenceEntity2UpdateReq
} from './converters'
import type { Requester } from '../../requester/types'
import type { Err, GoAsync } from '@nao-todo/types'
import type {
    CreateTagReq,
    CreateTagRes,
    GetTagPreferenceRes,
    GetTagRes,
    ListTagRes,
    ResponseData,
    UpdateTagPreferenceRes,
    UpdateTagReq
} from '../types'
import { defaultPreference } from '../../consts/preference'
import {
    TagEntity,
    TagPreferenceEntity,
    CreateTagValueObject,
    UpdateTagValueObject,
    type TagRepository
} from '@nao-todo/domain/tag'

/**
 * 标签仓库实现
 * @param requester 请求器
 * @returns 标签仓库实现
 */
export const useTagRepository = (requester: Requester): TagRepository => {
    /**
     * 获取标签
     * @param tagId 标签 ID
     * @returns 标签实体
     */
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

    /**
     * 创建标签
     * @param createTagValueObject 创建标签值对象
     * @returns 标签实体
     */
    const create = async (
        createTagValueObject: CreateTagValueObject
    ): GoAsync<TagEntity | null> => {
        // 1. 构建 rto
        const rto: CreateTagReq = {
            name: createTagValueObject.name,
            description: createTagValueObject.description || '',
            color: createTagValueObject.color || 'transparent'
        }
        // 2. 调用接口
        const response = await requester.post('/tags/', rto, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
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

    /**
     * 更新标签
     * @param tagId 标签 ID
     * @param updateTagValueObject 更新标签值对象
     * @returns 更新结果
     */
    const update = async (
        tagId: string,
        updateTagValueObject: UpdateTagValueObject
    ): GoAsync<void> => {
        // 1. 构建 rto
        const rto: UpdateTagReq = {}
        if (updateTagValueObject.name) rto.name = updateTagValueObject.name
        if (updateTagValueObject.description) rto.description = updateTagValueObject.description
        if (updateTagValueObject.color) rto.color = updateTagValueObject.color
        // 2. 调用接口
        const response = await requester.put(`/tags/${tagId}`, rto, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 30020) {
            return res.message
        }
        // 4. 返回
        // const data = res.data as UpdateTagRes
        return null
    }

    /**
     * 删除标签
     * @param tagId 标签 ID
     * @returns 删除结果
     */
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

    /**
     * 获取标签列表
     * @returns 标签实体
     */
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

    /**
     * 获取标签偏好
     * @param tagId 标签 ID
     * @returns 标签偏好实体
     */
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
        return [
            new TagPreferenceEntity(
                '',
                '',
                tagId,
                defaultPreference.viewType,
                defaultPreference.getTasksOptions,
                defaultPreference.columns
            ),
            null
        ]
    }

    /**
     * 更新标签偏好
     * @param tagId 标签 ID
     * @param preferenceEntity 标签偏好实体
     * @returns 更新结果
     */
    const updatePreference = async (
        tagId: string,
        preferenceEntity: TagPreferenceEntity
    ): GoAsync<string> => {
        // 1. 构建 rto
        const rto = tagPreferenceEntity2UpdateReq(preferenceEntity)
        // 1. 调用接口
        const response = await requester.post(`/tags/${tagId}/preference`, rto, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 30060) {
            return [null, res.message]
        }
        // 3. 返回
        return [res.data as UpdateTagPreferenceRes, null]
    }

    return { create, get, update, remove, list, getPreference, updatePreference }
}

