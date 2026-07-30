import { BuiltInProjectDomain } from '@nao-todo/domain-built-in-project'
import type { BuiltInProjectStore } from '@nao-todo/domain-built-in-project'
import { BuiltInProjectUseCase } from '@nao-todo/domain-built-in-project'
import { useBuiltInProjectRepository } from '@nao-todo/infrastructure'

/**
 * 创建内建项目用例
 * @param store 内建项目用例存储
 * @returns 内建项目用例
 */
export const useBuiltInProjectUseCase = (store: BuiltInProjectStore): BuiltInProjectUseCase => {
    const repo = useBuiltInProjectRepository()
    const builtInProjectDomain = new BuiltInProjectDomain(repo)
    return new BuiltInProjectUseCase(builtInProjectDomain, store)
}