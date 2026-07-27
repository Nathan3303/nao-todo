import { TagDomain } from '@nao-todo/domain/tag'
import type { TagStore } from '@nao-todo/application/tag/viewobjects'
import { TagUseCase } from '@nao-todo/application/tag/usecases'
import { TagPreferenceRepoImpl, TagRepoImpl } from '@nao-todo/infrastructure/backend'
import { getRequesterImpl } from '@nao-todo/shared'

/**
 * 创建标签使用案例
 * @param store 标签状态管理
 * @returns 标签使用案例
 */
export const useTagUseCase = (store: TagStore) => {
    const requester = getRequesterImpl()
    const tagRepo = new TagRepoImpl(requester)
    const tagPreferenceRepo = new TagPreferenceRepoImpl(requester)
    const domain = new TagDomain(tagRepo)
    return new TagUseCase(domain, tagRepo, tagPreferenceRepo, store)
}