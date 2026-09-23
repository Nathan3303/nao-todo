import type { AuthUseCase, UserUseCase } from '@nao-todo/domain-identity'
import type { PomodoroRecordRepository, PomodoroRepository } from '@nao-todo/domain-pomodoro'
import type { ProjectPreferenceRepository, ProjectRepository } from '@nao-todo/domain-project'
import type { TagPreferenceRepository, TagRepository } from '@nao-todo/domain-tag'
import type {
    TaskCheckItemRepository,
    TaskCommentRepository,
    TaskRepository
} from '@nao-todo/domain-task'
import {
    ProjectPreferenceRepoImpl,
    ProjectRepoImpl,
    TagPreferenceRepoImpl,
    TagRepoImpl,
    TaskCheckItemRepoImpl,
    TaskCommentRepoImpl,
    TaskRepoImpl,
    newPomodoroRecordRepository,
    newPomodoroRepository
} from '@nao-todo/infrastructure'
import { getRequesterImpl } from '@nao-todo/shared'

/**
 * 用例装配绑定（端差异唯一注入点）
 * @description 共享用例（`apps/web/src/hooks/usecases/**`）统一经 `@/hooks/usecases/binding`
 *              读取本模块：web 构建解析到本文件（远端仓储）；desktop 构建经
 *              `electron.vite.config.ts` 的 `@/hooks` 别名（先于 `@` 命中）解析到 desktop 侧同名文件
 *              （本地仓储）。业务数据仓储在此注入；认证/用户用例的端专属装饰（本地解锁、
 *              注销调度、密钥重包）经 `decorateAuthUseCase` / `decorateUserUseCase` 注入（web 端不提供）。
 */
export type UseCaseBinding = {
    createTaskRepository: () => TaskRepository
    createTaskCheckItemRepository: () => TaskCheckItemRepository
    createTaskCommentRepository: () => TaskCommentRepository
    createProjectRepository: () => ProjectRepository
    createProjectPreferenceRepository: () => ProjectPreferenceRepository
    createTagRepository: () => TagRepository
    createTagPreferenceRepository: () => TagPreferenceRepository
    createPomodoroRepository: () => PomodoroRepository
    createPomodoroRecordRepository: () => PomodoroRecordRepository
    decorateAuthUseCase?: (useCase: AuthUseCase) => AuthUseCase
    decorateUserUseCase?: (useCase: UserUseCase) => UserUseCase
}

/** web 端绑定：业务数据仓储全部经 requester 走后端 API */
export const useCaseBinding: UseCaseBinding = {
    createTaskRepository: () => new TaskRepoImpl(getRequesterImpl()),
    createTaskCheckItemRepository: () => new TaskCheckItemRepoImpl(getRequesterImpl()),
    createTaskCommentRepository: () => new TaskCommentRepoImpl(getRequesterImpl()),
    createProjectRepository: () => new ProjectRepoImpl(getRequesterImpl()),
    createProjectPreferenceRepository: () => new ProjectPreferenceRepoImpl(getRequesterImpl()),
    createTagRepository: () => new TagRepoImpl(getRequesterImpl()),
    createTagPreferenceRepository: () => new TagPreferenceRepoImpl(getRequesterImpl()),
    createPomodoroRepository: () => newPomodoroRepository(getRequesterImpl()),
    createPomodoroRecordRepository: () => newPomodoroRecordRepository(getRequesterImpl())
}