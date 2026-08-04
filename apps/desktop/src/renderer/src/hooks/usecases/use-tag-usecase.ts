import { TagService, TagStore, TagUseCase } from '@nao-todo/domain-tag'
import { newLocalTagPreferenceRepository, newLocalTagRepository } from '@nao-todo/infrastructure'

/**
 * 标签用例（桌面版本地仓储）
 * @param store 标签状态管理
 * @returns 标签使用案例
 */
export const useTagUseCase = (store: TagStore) => {
    const tagRepo = newLocalTagRepository()
    const tagPreferenceRepo = newLocalTagPreferenceRepository()
    const domain = new TagService(tagRepo)
    return new TagUseCase(domain, tagRepo, tagPreferenceRepo, store)
}