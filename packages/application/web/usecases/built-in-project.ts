import type { BuiltInProjectDomain } from '@nao-todo/domain/built-in-project/services'
import type {
    BuiltInProject,
    BuiltInProjectPreference
} from '@nao-todo/infrastructure/built-in/project/types'
import type { Go } from '@nao-todo/types'
import {
    builtInProjectEntities2ViewObjects,
    builtInProjectPreferenceValueObject2ViewObject
} from '../converters/built-in-project'

export interface BuiltInProjectUseCaseStore {
    setBuiltInProjects(builtInProjects: BuiltInProject[]): void
    setBuiltInProjectPreference(preference: BuiltInProjectPreference): void
}

export class BuiltInProjectUseCase {
    /**
     * 内建项目用例
     * @param builtInProjectDomain 内建项目领域服务
     * @param store 内建项目用例存储
     */
    constructor(
        private builtInProjectDomain: BuiltInProjectDomain,
        private store: BuiltInProjectUseCaseStore
    ) {}

    /**
     * 加载内建项目
     * @returns 错误信息
     */
    loadBuiltInProjects(): Go<BuiltInProject['id'][]> {
        // 1. 获取内建项目实体
        const [builtInProjectEntities, err] = this.builtInProjectDomain.list()
        if (err !== null) {
            return [null, err]
        }
        const builtInProjects = builtInProjectEntities2ViewObjects(builtInProjectEntities)
        // 2. 获取内建项目ID列表
        const builtInProjectIds = builtInProjects.map((entity) => entity.id)
        // 3. 存储内建项目实体
        this.store.setBuiltInProjects(builtInProjects)
        // 4. 返回
        return [builtInProjectIds, null]
    }

    /**
     * 加载内建项目
     * @param id 内建项目ID
     * @returns 错误信息
     */
    // loadBuiltInProject(id: BuiltInProject['id']): Go<void> {
    //     // 1. 获取内建项目实体
    //     const [builtInProjectEntity, err] = this.builtInProjectDomain.get(id)
    //     if (err !== null) {
    //         return err
    //     }
    //     // 2. 实体转换
    //     // const builtInProject = builtInProjectEntity.toValueObject()
    //     // 2. 存储内建项目实体
    //     this.store.setBuiltInProjects([builtInProjectEntity])
    //     return null
    // }

    /**
     * 加载内建项目偏好
     * @param builtInProjectId 内建项目ID
     * @returns 错误信息
     */
    loadBuiltInProjectPreference(userId: string, builtInProjectId: BuiltInProject['id']): Go<void> {
        // 1. 获取内建项目偏好实体
        const [builtInProjectPreferenceEntity, err] = this.builtInProjectDomain.getPreference(
            userId,
            builtInProjectId
        )
        if (err !== null) {
            return err
        }
        // 2. 实体转换
        const builtInProjectPreference = builtInProjectPreferenceValueObject2ViewObject(
            builtInProjectPreferenceEntity
        )
        // 3. 存储内建项目偏好实体
        this.store.setBuiltInProjectPreference(builtInProjectPreference)
        // 4. 返回
        return null
    }
}
