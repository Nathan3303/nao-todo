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
    // 阶段二 2A / W3：容器域（标签）已切本地优先 ⇒ web binding 对该域**不再套**离线只读闸门（ADR §5 M5）
    // （钩子仍保留给未切换的域；desktop binding 不提供该钩子 ⇒ 写路径不变）
    return useCaseBinding.decorateUseCase?.(useCase, 'tag') ?? useCase
}