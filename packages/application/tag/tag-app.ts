import { useTagDomain } from '@nao-todo/domain/tag'
import { useTagRepository } from '@nao-todo/infrastructure/backend/tag/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import type {
    CreateTagVO,
    Err,
    GoAsync,
    TagPreferenceVO,
    TagVO,
    UpdateTagVO
} from '@nao-todo/types'
import { ref, type Ref } from 'vue'
import {
    tagEntities2TagVO,
    tagEntity2TagVO,
    tagPreferenceEntity2TagPreferenceVO
} from './converters'
import useListMapper from '@nao-todo/infrastructure/hooks/use-list-mapper'

export interface TagApp {
    tags: Ref<TagVO[]>
    list: () => Promise<Err>
    getById: (id: string) => GoAsync<TagVO>
    getPreference: (id: string) => GoAsync<TagPreferenceVO>
    create: (vo: CreateTagVO) => GoAsync<TagVO>
    update: (id: TagVO['id'], updateVO: UpdateTagVO) => GoAsync<void>
    getByIdFromMap: (id: string) => TagVO | undefined
}

export default (): TagApp => {
    // @domain 标签域
    const tagDomain = useTagDomain(useTagRepository(getRequesterImpl()))

    /**
     * 标签列表以及相关方法
     */

    // @state 标签列表
    const tags = ref<TagVO[]>([])

    // @method 获取标签列表
    const list = async (): Promise<Err> => {
        // 1. 调用域服务
        const [tagEntities, err] = await tagDomain.list()
        if (err) return err
        // 2. 更新状态
        tags.value = tagEntities2TagVO(tagEntities!)
        // 3. 返回
        return null
    }

    // @method 根据 ID 获取标签详情
    const getById = async (id: string): GoAsync<TagVO> => {
        // 1. 判断 id
        if (!id) return [null, '标签 ID 不能为空']
        // 2. 调用域服务
        const [tagEntity, err] = await tagDomain.get(id)
        if (err !== null) {
            return [null, err]
        }
        // 3. 实体转viewobject
        const tag = tagEntity2TagVO(tagEntity)
        // 4. 返回
        return [tag, null]
    }

    // @method 获取标签偏好
    const getPreference = async (id: string): GoAsync<TagPreferenceVO> => {
        // 1. 判断 id
        if (!id) return [null, '标签 ID 不能为空']
        // 2. 调用域服务
        const [tagPreference, err] = await tagDomain.getPreference(id)
        if (err !== null) {
            return [null, err]
        }
        // 3. 实体转viewobject
        const tagPreferenceVO = tagPreferenceEntity2TagPreferenceVO(tagPreference)
        // 4. 返回
        return [tagPreferenceVO, null]
    }

    // @method 创建标签
    const create = async (vo: CreateTagVO): GoAsync<TagVO> => {
        // 1. 判断 vo
        if (!vo.name) return [null, '标签名称不能为空']
        // 2. 调用域服务
        const [tagEntity, err] = await tagDomain.create(vo)
        if (err !== null) {
            return [null, err]
        }
        // 3. 实体转viewobject
        const tag = tagEntity2TagVO(tagEntity)
        // 4. 返回
        return [tag, null]
    }

    // @method 更新标签
    const update = async (id: TagVO['id'], updateVO: UpdateTagVO): GoAsync<void> => {
        // 1. 参数判断
        if (!id) return '标签 ID 不能为空'
        // 2. 调用域服务
        const err = await tagDomain.update(id, updateVO)
        if (err !== null) {
            return err
        }
        // 3. 返回
        return null
    }

    /**
     * 标签 Mapper 以及相关方法
     * 主要提供 O(1) 时间复杂度的查询，用于在视图层快速获取标签详情
     * Computed 实现响应式变化
     */

    // @hook useListMapper
    const { get: getByIdFromMap } = useListMapper(tags)

    // @returns
    return { tags, list, getById, getPreference, create, update, getByIdFromMap }
}
