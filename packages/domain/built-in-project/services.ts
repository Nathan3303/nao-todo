import type { Go } from '@nao-todo/shared'
import { BuiltInProjectEntity, BuiltInProjectPreferenceEntity } from './entities'
import type { BuiltInProjectRepository } from './repositories'

export class BuiltInProjectDomain {
    /**
     * 内建清单域服务
     * @param builtInProjectRepo 内建清单存储库
     */
    constructor(private builtInProjectRepo: BuiltInProjectRepository) {}

    /**
     * 获取内建清单
     * @param id 内建清单 ID
     * @returns 内建清单
     */
    get(id: string): Go<BuiltInProjectEntity> {
        return this.builtInProjectRepo.get(id)
    }

    /**
     * 获取内建清单列表
     * @returns 内建清单列表
     */
    list(): Go<BuiltInProjectEntity[]> {
        return this.builtInProjectRepo.list()
    }

    /**
     * 获取内建清单偏好
     * @param userId 用户 ID
     * @param projectId 内建清单 ID
     * @returns 内建清单偏好
     */
    getPreference(userId: string, projectId: string): Go<BuiltInProjectPreferenceEntity> {
        return this.builtInProjectRepo.getPreference(userId, projectId)
    }

    /**
     * 保存内建清单偏好
     * @param userId 用户 ID
     * @param preference 内建清单偏好
     * @returns 错误信息
     */
    savePreference(
        userId: string,
        projectId: string,
        preference: BuiltInProjectPreferenceEntity
    ): Go<void> {
        return this.builtInProjectRepo.savePreference(userId, projectId, preference)
    }
}

const useBuiltInProjectDomain = (
    builtInProjectRepo: BuiltInProjectRepository
): BuiltInProjectDomain => {
    return new BuiltInProjectDomain(builtInProjectRepo)
}

export default useBuiltInProjectDomain
