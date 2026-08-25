import {
    TagService,
    TagUseCase,
    type CreateTagViewObject,
    type UpdateTagViewObject
} from '@nao-todo/domain-tag'
import { TagPreferenceRepoImpl } from '@nao-todo/infrastructure/src/persistence-go/tag/tag-preference'
import { TagRepoImpl } from '@nao-todo/infrastructure/src/persistence-go/tag/tag'
import type { Requester } from '@nao-todo/shared/requester/types'
import type { GoError } from '@nao-todo/shared/types'
import type { TagStoreCore } from './tag-store-core'

/**
 * 标签用例接口（组合后的门面）
 * @description 封装 domain-tag 的 TagUseCase（含偏好），页面只消费本接口。
 */
export type ComposedTagUseCase = {
    loadTags: () => Promise<GoError>
    createTag: (viewObject: CreateTagViewObject) => ReturnType<TagUseCase['create']>
    updateTag: (id: string, update: UpdateTagViewObject) => Promise<GoError>
    deleteTag: (tagId: string) => Promise<GoError>
}

/**
 * 组装标签用例
 * @description Requester → Repos（标签 + 偏好）→ TagService → TagUseCase
 * @param requester 请求器
 * @param store 标签存储（实现 TagStore）
 * @returns 标签用例门面
 */
export const composeTagUseCase = (
    requester: Requester,
    store: TagStoreCore
): ComposedTagUseCase => {
    const tagRepo = new TagRepoImpl(requester)
    const preferenceRepo = new TagPreferenceRepoImpl(requester)
    const tagService = new TagService(tagRepo)
    const tagUseCase = new TagUseCase(tagService, tagRepo, preferenceRepo, store)

    return {
        loadTags: () => tagUseCase.loadTags(),
        createTag: (viewObject) => tagUseCase.create(viewObject),
        updateTag: (id, update) => tagUseCase.update(id, update),
        deleteTag: (tagId) => tagUseCase.delete(tagId)
    }
}