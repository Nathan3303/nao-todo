import { BuiltInProjectDomain, BuiltInProjectUseCase } from '@nao-todo/domain-built-in-project'
import type {
    BuiltInProjectEntity,
    BuiltInProjectPreferenceEntity,
    BuiltInProjectRepository
} from '@nao-todo/domain-built-in-project'
import type { Go } from '@nao-todo/shared/types'
import {
    bipRes2bipEntity,
    bippRes2bippVO
} from '@nao-todo/infrastructure/src/built-in/project/converters'
import {
    defaultBuiltInProjectPreferences,
    defaultBuiltInProjects
} from '@nao-todo/infrastructure/src/built-in/project/default'
import type { BuiltInProjectPreferenceRes } from '@nao-todo/infrastructure/src/built-in/project/types'
import type { BuiltInProjectStoreCore } from './built-in-project-store-core'

/**
 * Lynx 安全的内建清单仓储实现
 * @description Web 版 repoImpl 偏好部分直连 localStorage（Lynx 不可用）：
 *              本实现复用默认清单/默认偏好数据（纯常量），偏好改为内存态（MVP 不持久化，
 *              符合规划「Won't: 本地离线缓存」边界）。
 */
export const createLynxBuiltInProjectRepository = (): BuiltInProjectRepository => {
    const preferenceMap = new Map<string, BuiltInProjectPreferenceRes>()

    return {
        get: (id): Go<BuiltInProjectEntity> => {
            const builtInProject = defaultBuiltInProjects.find((item) => item.id === id)
            if (!builtInProject) return [null, '清单不存在']
            return [bipRes2bipEntity(builtInProject), null]
        },
        list: (): Go<BuiltInProjectEntity[]> => {
            return [defaultBuiltInProjects.map(bipRes2bipEntity), null]
        },
        getPreference: (userId, id): Go<BuiltInProjectPreferenceEntity> => {
            const key = `${userId}/${id}`
            const cached = preferenceMap.get(key)
            if (cached) return [bippRes2bippVO({ ...cached, projectId: id }), null]
            const defaultPreference = defaultBuiltInProjectPreferences.find(
                (pp) => pp.projectId === id
            )
            if (defaultPreference) {
                return [bippRes2bippVO({ ...defaultPreference, projectId: id }), null]
            }
            return [null, '清单偏好获取失败']
        },
        savePreference: (_userId, projectId, preference): Go<void> => {
            const key = `${_userId}/${projectId}`
            // BuiltInProjectPreferenceEntity 与 Res 结构兼容，直接缓存实体值
            preferenceMap.set(key, preference as unknown as BuiltInProjectPreferenceRes)
            return null
        }
    }
}

/**
 * 内建清单用例接口（组合后的门面）
 */
export type ComposedBuiltInProjectUseCase = {
    loadBuiltInProjects: () => Go<void>
}

/**
 * 组装内建清单用例
 * @description 内建清单为本地默认数据（无 HTTP），直接组装 Lynx 安全仓储 + 领域服务 + 用例。
 * @param store 内建清单存储（实现 BuiltInProjectStore）
 * @returns 内建清单用例门面
 */
export const composeBuiltInProjectUseCase = (
    store: BuiltInProjectStoreCore
): ComposedBuiltInProjectUseCase => {
    const repo = createLynxBuiltInProjectRepository()
    const domain = new BuiltInProjectDomain(repo)
    const useCase = new BuiltInProjectUseCase(domain, store)

    return {
        loadBuiltInProjects: () => useCase.loadBuiltInProjects()
    }
}