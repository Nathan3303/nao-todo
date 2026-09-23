import { TagService, TagStore, TagUseCase } from '@nao-todo/domain-tag'
import { useCaseBinding } from '@/hooks/usecases/binding'

/**
 * 创建标签使用案例
 * @param store 标签状态管理
 * @returns 标签使用案例
 */
export const useTagUseCase = (store: TagStore) => {
    const tagRepo = useCaseBinding.createTagRepository()
    const tagPreferenceRepo = useCaseBinding.createTagPreferenceRepository()
    const domain = new TagService(tagRepo)
    const useCase = new TagUseCase(domain, tagRepo, tagPreferenceRepo, store)
    // C-59 / AC10：web 离线只读闸门经 binding 注入（web-only）
    return useCaseBinding.decorateUseCase?.(useCase, 'tag') ?? useCase
}