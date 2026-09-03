import type { TagEntity, TagRepository } from '@nao-todo/domain-tag'
import type { GoAsync, Requester } from '@nao-todo/shared'
import { CreateTagRes, ResponseData, TagRes } from '../models'
import { getJWTFromLocalStorage } from '../utils'
import {
    createTagRes2Entity,
    listTagRes2Entities,
    tagEntity2CreateReq,
    tagEntity2UpdateReq,
    tagRes2Entity
} from './converters'

/**
 * 标签仓库实现
 */
export class TagRepoImpl implements TagRepository {
    /**
     * 标签仓库构造函数
     * @param requester 请求器
     */
    constructor(private requester: Requester) {}

    /**
     * 获取标签
     * @param id 标签 ID
     * @returns 标签实体
     */
    async getById(id: string): GoAsync<TagEntity> {
        // 1. 调用接口
        const response = await this.requester.get(`/tags/${id}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 30000) {
            return [null, res.message]
        }
        // 3. 返回
        return [tagRes2Entity(res.data as TagRes), null]
    }

    /**
     * 创建标签
     * @param createdEntity 创建标签实体
     * @returns 标签实体
     */
    async create(createdEntity: TagEntity): GoAsync<TagEntity> {
        // 1. 构建 RTO
        const createRTO = tagEntity2CreateReq(createdEntity)
        // 2. 调用接口
        const response = await this.requester.post('/tags/', createRTO, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 30010) {
            return [null, res.message]
        }
        // 4. 返回
        return [createTagRes2Entity(res.data as CreateTagRes), null]
    }

    /**
     * 更新标签
     * @param updatedEntity 更新标签实体
     * @returns 更新结果
     */
    async update(updatedEntity: TagEntity): GoAsync<void> {
        // 1. 构建 RTO
        const updateRTO = tagEntity2UpdateReq(updatedEntity)
        // 2. 调用接口
        const response = await this.requester.put(`/tags/${updatedEntity.id}`, updateRTO, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 30020) {
            return res.message
        }
        // 4. 返回
        return null
    }

    /**
     * 删除标签
     * @param id 标签 ID
     * @returns 删除结果
     */
    async deleteById(id: string): GoAsync<void> {
        // 1. 调用接口
        const response = await this.requester.delete(`/tags/${id}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
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
     * @returns 标签实体列表
     */
    async list(): GoAsync<TagEntity[]> {
        // 1. 调用接口
        const response = await this.requester.get('/tags/', {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 获取结果
        const res = response.data as ResponseData
        if (res.code !== 30040) {
            return [null, res.message]
        }
        // 3. 返回
        return [listTagRes2Entities(res.data as TagRes[]), null]
    }

    /**
     * 获取标签列表
     * @param ids 标签ID数组
     * @returns 标签实体数组
     */
    async getByIds(ids: string[]): GoAsync<TagEntity[]> {
        // 1. 调用接口
        const response = await this.requester.get(`/tags/?ids=${ids.join(',')}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 获取结果
        const res = response.data as ResponseData
        if (res.code !== 30040) {
            return [null, res.message]
        }
        // 3. 转换为结果
        const result = listTagRes2Entities(res.data as TagRes[])
        // 4. 返回
        return [result, null]
    }

    /**
     * 批量更新标签
     * @param updatedEntities 更新标签实体列表
     * @returns 更新结果
     */
    async batchUpdate(updatedEntities: TagEntity[]): GoAsync<TagEntity[]> {
        // 1. 构建 RTO
        const updateRTO = updatedEntities.map((tag) => tagEntity2UpdateReq(tag))
        // 2. 调用接口
        const response = await this.requester.put(
            '/tags/',
            { tags: updateRTO },
            { headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` } }
        )
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 30070) {
            return [null, res.message]
        }
        // 4. 转换为结果
        const result = listTagRes2Entities(res.data as TagRes[])
        // 5. 返回
        return [result, null]
    }
}

/**
 * 创建标签仓库
 * @param requester 请求器
 * @returns 标签仓库
 */
export const newTagRepository = (requester: Requester) => {
    return new TagRepoImpl(requester)
}