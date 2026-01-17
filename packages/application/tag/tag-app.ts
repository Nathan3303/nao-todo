import { useTagDomain } from '@nao-todo/domain/tag'
import { useTagRepository } from '@nao-todo/infrastructure/backend/tag/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import type {
    CreateTagVO,
    GoAsync,
    TagPreferenceVO,
    TagVO,
    UpdateTagVO,
    WithNull
} from '@nao-todo/types'
import { reactive, type Reactive } from 'vue'
import {
    tagEntities2TagVO,
    tagEntity2TagVO,
    tagPreferenceEntity2TagPreferenceVO,
    tagPreferenceVO2Entity
} from './converters'

export type TagAppStates = {
    tags: TagVO[]
    tag: WithNull<TagVO>
    preference: WithNull<TagPreferenceVO>
    tagsMap: Map<string, TagVO>
}

export interface TagApp {
    states: Reactive<TagAppStates>
    list: () => GoAsync<TagVO[]>
    getById: (id: string) => GoAsync<TagVO>
    getPreference: (id: string) => GoAsync<TagPreferenceVO>
    create: (vo: CreateTagVO) => GoAsync<TagVO>
    update: (id: TagVO['id'], updateVO: UpdateTagVO) => GoAsync<void>
    getByIdFromMap: (id: string) => TagVO | undefined
    updatePreference: (id: string, preferenceVO: TagPreferenceVO) => GoAsync<string>
}

export default (): TagApp => {
    // @domain 标签域
    const tagDomain = useTagDomain(useTagRepository(getRequesterImpl()))

    // @states
    const states = reactive<TagAppStates>({
        tags: [],
        tag: null,
        preference: null,
        tagsMap: new Map()
    })

    // @method 获取标签列表
    const list = async (): GoAsync<TagVO[]> => {
        // 1. 调用域服务
        const [tagEntities, err] = await tagDomain.list()
        if (err !== null) {
            return [null, err]
        }
        // 2. 转换
        const tagVOs = tagEntities2TagVO(tagEntities)
        // 2. 更新状态
        states.tags = tagVOs
        states.tagsMap = new Map(states.tags.map((tag) => [tag.id, tag]))
        // 3. 返回
        return [tagVOs, null]
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
        // 4. 更新状态
        states.tag = tag
        // 5. 返回
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
        // 4. 更新状态
        states.preference = tagPreferenceVO
        // 5. 返回
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
        // 4. 更新状态
        states.tags.push(tag)
        states.tagsMap.set(tag.id, tag)
        // 5. 返回
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
        // 3. 更新状态
        const idx = states.tags.findIndex((tag) => tag.id === id)
        if (idx !== -1) {
            states.tags[idx] = { ...states.tags[idx], ...updateVO }
        }
        // 4. 返回
        return null
    }

    // @method 根据 ID 从 Map 中获取标签详情
    const getByIdFromMap = (id: string): TagVO | undefined => {
        return states.tagsMap.get(id)
    }

    // @method 更新标签偏好
    const updatePreference = async (id: string, preferenceVO: TagPreferenceVO): GoAsync<string> => {
        // 1. 判断 id
        if (!id) return [null, '标签 ID 不能为空']
        // 2. 调用域服务
        const tagPreferenceEntity = tagPreferenceVO2Entity(preferenceVO)
        const [tagId, err] = await tagDomain.updatePreference(id, tagPreferenceEntity)
        if (err !== null) {
            return [null, err]
        }
        // 3. 更新状态
        states.preference = preferenceVO
        // 4. 返回
        return [tagId, null]
    }

    // @returns
    return {
        states,
        list,
        getById,
        getPreference,
        create,
        update,
        getByIdFromMap,
        updatePreference
    }
}
