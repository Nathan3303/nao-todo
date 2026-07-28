import type {
    CreateTagValueObject,
    TagEntity,
    TagRepository,
    UpdateTagValueObject
} from '@nao-todo/domain/tag'
import type { GoAsync, Requester } from '@nao-todo/shared'
import { CreateTagRes, ResponseData, TagRes } from '../models'
import { getJWTFromLocalStorage } from '../utils'
import {
    createTagRes2Entity,
    createTagValueObject2Req,
    listTagRes2Entities,
    tagRes2Entity,
    updateTagValueObject2Req
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
    async get(id: string): GoAsync<TagEntity> {
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
     * @param createVO 创建标签值对象
     * @returns 标签实体
     */
    async create(createVO: CreateTagValueObject): GoAsync<TagEntity> {
        // 1. 构建 rto
        const createRto = createTagValueObject2Req(createVO)
        // 2. 调用接口
        const response = await this.requester.post('/tags/', createRto, {
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
     * @param updateVO 更新标签值对象
     * @returns 更新结果
     */
    async update(updateVO: UpdateTagValueObject): GoAsync<void> {
        // 1. 构建 rto
        const updateRto = updateTagValueObject2Req(updateVO)
        // 2. 调用接口
        const response = await this.requester.put(`/tags/${updateVO.id}`, updateRto, {
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
    async delete(id: string): GoAsync<void> {
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
     * 批量更新标签
     * @param updateVOs 更新标签值对象列表
     * @returns 更新结果
     */
    async batchUpdate(updateVOs: UpdateTagValueObject[]): GoAsync<TagEntity[]> {
        // 1. 构建 rto
        const updateRto = updateVOs.map((tag) => updateTagValueObject2Req(tag))
        // 2. 调用接口
        const response = await this.requester.put(
            '/tags/',
            { tags: updateRto },
            { headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` } }
        )
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 30100) {
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