import { BuiltInProjectDomain } from '@nao-todo/domain/built-in-project/services'
import type { BuiltInProjectViewObject, BuiltInProjectPreferenceViewObject } from '@nao-todo/types'
import type { Go } from '@nao-todo/types'
import useBuiltInProjectRepository from '@nao-todo/infrastructure/built-in/project/repoImpl'
import {
    builtInProjectEntities2ViewObjects,
    builtInProjectPreferenceEntity2ViewObject,
    builtInProjectPreferenceViewObject2Entity
} from '../converters/built-in-project'

export interface BuiltInProjectUseCaseStore {
    getBuiltInProjectPreference(): BuiltInProjectPreferenceViewObject | undefined
    setBuiltInProjects(builtInProjects: BuiltInProjectViewObject[]): void
    setBuiltInProjectPreference(preference: BuiltInProjectPreferenceViewObject): void
}

/**
 * 内建项目用例
 */
export class BuiltInProjectUseCase {
    /**
     * 内建项目用例构造函数
     * @param builtInProjectDomain 内建项目领域服务
     * @param store 内建项目用例存储
     */
    constructor(
        private builtInProjectDomain: BuiltInProjectDomain,
        private store: BuiltInProjectUseCaseStore
    ) {}

    /**
     * 内建项目用例创建函数
     * @param builtInProjectStore 内建项目用例存储
     * @returns 内建项目用例
     */
    static create(builtInProjectStore: BuiltInProjectUseCaseStore): BuiltInProjectUseCase {
        const repo = useBuiltInProjectRepository()
        const domain = new BuiltInProjectDomain(repo)
        return new BuiltInProjectUseCase(domain, builtInProjectStore)
    }

    /**
     * 加载内建项目
     * @returns 错误信息
     */
    loadBuiltInProjects(): Go<void> {
        // 1. 获取内建项目实体
        const [builtInProjectEntities, err] = this.builtInProjectDomain.list()
        if (err !== null) {
            return err
        }
        const builtInProjects = builtInProjectEntities2ViewObjects(builtInProjectEntities)
        // 2. 存储内建项目实体
        this.store.setBuiltInProjects(builtInProjects)
        // 3. 返回
        return null
    }

    /**
     * 加载内建项目偏好
     * @param builtInProjectId 内建项目ID
     * @returns 错误信息
     */
    loadBuiltInProjectPreference(
        userId: string,
        builtInProjectId: BuiltInProjectViewObject['id']
    ): Go<void> {
        // 1. 获取内建项目偏好实体
        const [builtInProjectPreferenceEntity, err] = this.builtInProjectDomain.getPreference(
            userId,
            builtInProjectId
        )
        if (err !== null) {
            return err
        }
        // 2. 实体转换
        const builtInProjectPreference = builtInProjectPreferenceEntity2ViewObject(
            builtInProjectPreferenceEntity
        )
        // 3. 存储内建项目偏好实体
        this.store.setBuiltInProjectPreference(builtInProjectPreference)
        // console.log(builtInProjectPreference)
        // 4. 返回
        return null
    }

    /**
     * 保存内建项目偏好
     * @param userId 用户ID
     * @returns 错误信息
     */
    savePreference(
        userId: string,
        builtInProjectId: BuiltInProjectViewObject['id'],
        newPreference: BuiltInProjectPreferenceViewObject
    ): Go<void> {
        // 1. 判断内建项目偏好是否存在
        if (!newPreference) return '内建项目偏好无效'
        // 2. 存储内建项目偏好实体
        return this.builtInProjectDomain.savePreference(
            userId,
            builtInProjectId,
            builtInProjectPreferenceViewObject2Entity(newPreference)
        )
    }
}

