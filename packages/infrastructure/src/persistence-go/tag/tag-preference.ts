import { TagPreferenceEntity, TagPreferenceRepository } from '@nao-todo/domain-tag'
import type { GoAsync, Requester } from '@nao-todo/shared'
import { getJWTFromLocalStorage } from '../utils'
import { ResponseData, TagPreferenceRes } from '../models'
import {
    defaultTagPreferenceRes2Entity,
    tagPreferenceRes2Entity,
    tagPreferenceEntity2UpdateReq
} from './converters'

/**
 * 标签偏好仓库实现
 */
export class TagPreferenceRepoImpl implements TagPreferenceRepository {
    /**
     * 标签偏好仓库构造函数
     * @param requester 请求器
     */
    constructor(private requester: Requester) {}

    /**
     * 获取标签偏好
     * @param id 标签偏好 ID
     * @returns 标签偏好实体
     */
    async get(id: string): GoAsync<TagPreferenceEntity> {
        // 1. 调用接口
        const response = await this.requester.get(`/tags/${id}/preference`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 获取
        const res = response.data as ResponseData
        // 3. 判断结果 - 获取失败返回默认结果（含 tagId 过滤）
        if (res.code !== 30050) {
            return [defaultTagPreferenceRes2Entity(id), null]
        }
        // 4. 返回
        return [tagPreferenceRes2Entity(res.data as TagPreferenceRes), null]
    }

    /**
     * 保存标签偏好
     * @param updatedEntity 更新后的标签偏好实体
     * @returns 无结果
     */
    async save(updatedEntity: TagPreferenceEntity): GoAsync<void> {
        // 1. 构建 rto
        const rto = tagPreferenceEntity2UpdateReq(updatedEntity)
        // 2. 调用接口
        const response = await this.requester.post(`/tags/${updatedEntity.tagId}/preference`, rto, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 30060) {
            return res.message
        }
        // 3. 返回
        return null
    }
}

/**
 * 创建标签偏好仓库
 * @param requester 请求器
 * @returns 标签偏好仓库
 */
export const newTagPreferenceRepository = (requester: Requester) => {
    return new TagPreferenceRepoImpl(requester)
}