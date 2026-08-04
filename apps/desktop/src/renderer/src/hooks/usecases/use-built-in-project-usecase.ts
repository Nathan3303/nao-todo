import { BuiltInProjectDomain } from '@nao-todo/domain-built-in-project'
import type { BuiltInProjectStore } from '@nao-todo/domain-built-in-project'
import { BuiltInProjectUseCase } from '@nao-todo/domain-built-in-project'
import { useBuiltInProjectRepository } from '@nao-todo/infrastructure'

/**
 * 内建项目用例（桌面版复用既有 localStorage 实现，与本地数据无关）
 */
export const useBuiltInProjectUseCase = (store: BuiltInProjectStore): BuiltInProjectUseCase => {
    const repo = useBuiltInProjectRepository()
    const builtInProjectDomain = new BuiltInProjectDomain(repo)
    return new BuiltInProjectUseCase(builtInProjectDomain, store)
}