import { useTagDomain } from '@nao-todo/domain/tag'
import { useTagRepository } from '@nao-todo/infrastructure/backend/tag/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import type { Err, GoAsync, TagPreferenceVO, TagVO } from '@nao-todo/types'
import { ComputedRef, ref, type Ref } from 'vue'
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
    tagMap: ComputedRef<Map<string, TagVO>>
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

    /**
     * 标签 Mapper 以及相关方法
     * 主要提供 O(1) 时间复杂度的查询，用于在视图层快速获取标签详情
     * Computed 实现响应式变化
     */

    // @hook useListMapper
    const { map: tagMap, get: getByIdFromMap } = useListMapper(tags)

    return { tags, list, getById, getPreference, tagMap, getByIdFromMap }
}
