import type { Go } from '@nao-todo/shared'
import type { BuiltInProjectEntity, BuiltInProjectPreferenceEntity } from '../entities'

export interface BuiltInProjectRepository {
    // 获取指定 ID 的清单
    get(id: string): Go<BuiltInProjectEntity>
    // 获取所有清单
    list(): Go<BuiltInProjectEntity[]>
    // 获取指定清单的偏好
    getPreference(userId: string, id: string): Go<BuiltInProjectPreferenceEntity>
    // 保存清单偏好
    savePreference(
        userId: string,
        projectId: string,
        preference: BuiltInProjectPreferenceEntity
    ): Go<void>
}