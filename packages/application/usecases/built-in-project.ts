import type { BuiltInProjectDomain } from '@nao-todo/domain/built-in-project/services'
import type { BuiltInProject } from '@nao-todo/infrastructure/built-in/project/types'
import type { Go } from '@nao-todo/types'

export interface BuiltInProjectUseCaseStore {
    setBuiltInProjects(builtInProjects: BuiltInProject[]): void
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
    loadBuiltInProjects(): Go<void> {
        // 1. 获取内建项目实体
        const [builtInProjectEntities, err] = this.builtInProjectDomain.list()
        if (err !== null) {
            return err
        }
        // 2. 实体转换
        // const 
        // 2. 存储内建项目实体
        this.store.setBuiltInProjects(builtInProjectEntities)
        return null
    }

    loadBuiltInProject(id: BuiltInProject['id']): Go<void> {
        // 1. 获取内建项目实体
        const [builtInProjectEntity, err] = this.builtInProjectDomain.get(id)
        if (err !== null) {
            return err
        }
        // 2. 实体转换
        // const builtInProject = builtInProjectEntity.toValueObject()
        // 2. 存储内建项目实体
        this.store.setBuiltInProjects([builtInProjectEntity])
        return null
    }
}
