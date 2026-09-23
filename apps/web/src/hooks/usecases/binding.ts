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
    newLocalPomodoroRecordRepository,
    newLocalPomodoroRepository,
    newLocalProjectPreferenceRepository,
    newLocalProjectRepository,
    newLocalTagPreferenceRepository,
    newLocalTagRepository,
    newLocalTaskCheckItemRepository,
    newLocalTaskCommentRepository,
    newLocalTaskRepository,
    newPomodoroRecordRepository,
    newPomodoroRepository,
    withMirrorFallback
} from '@nao-todo/infrastructure'
import { getRequesterImpl } from '@nao-todo/shared'

/**
 * 用例装配绑定（端差异唯一注入点）
 * @description 共享用例（`apps/web/src/hooks/usecases/**`）统一经 `@/hooks/usecases/binding`
 *              读取本模块：web 构建解析到本文件，desktop 构建经
 *              `electron.vite.config.ts` 的 `@/hooks` 别名（先于 `@` 命中）解析到 desktop 侧同名文件
 *              （本地仓储）。业务数据仓储在此注入；认证/用户用例的端专属装饰（本地解锁、
 *              注销调度、密钥重包）经 `decorateAuthUseCase` / `decorateUserUseCase` 注入（web 端不提供）。
 *
 *              **web 读路径 = 远端优先 + 网络类失败回退本地镜像**（C-66 / AC8）：远端仓储为**主读**，
 *              由 `withMirrorFallback` 装饰（只包装读方法）；写路径不变（仍走远端，阶段一由 UI 层禁写，C-59）。
 *              本地镜像由 `@/data-plane` 后台启动的 `syncService` 填充。
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

/** web 端绑定：远端仓储为主读，网络类失败回退本地镜像 */
export const useCaseBinding: UseCaseBinding = {
    createTaskRepository: () =>
        withMirrorFallback<TaskRepository>(
            new TaskRepoImpl(getRequesterImpl()),
            newLocalTaskRepository(),
            ['get', 'list']
        ),
    createTaskCheckItemRepository: () =>
        withMirrorFallback<TaskCheckItemRepository>(
            new TaskCheckItemRepoImpl(getRequesterImpl()),
            newLocalTaskCheckItemRepository(),
            ['get', 'list']
        ),
    createTaskCommentRepository: () =>
        withMirrorFallback<TaskCommentRepository>(
            new TaskCommentRepoImpl(getRequesterImpl()),
            newLocalTaskCommentRepository(),
            ['get', 'list']
        ),
    createProjectRepository: () =>
        withMirrorFallback<ProjectRepository>(
            new ProjectRepoImpl(getRequesterImpl()),
            newLocalProjectRepository(),
            ['get', 'list']
        ),
    createProjectPreferenceRepository: () =>
        withMirrorFallback<ProjectPreferenceRepository>(
            new ProjectPreferenceRepoImpl(getRequesterImpl()),
            newLocalProjectPreferenceRepository(),
            ['getByProjectId']
        ),
    createTagRepository: () =>
        withMirrorFallback<TagRepository>(
            new TagRepoImpl(getRequesterImpl()),
            newLocalTagRepository(),
            ['getById', 'list', 'getByIds']
        ),
    createTagPreferenceRepository: () =>
        withMirrorFallback<TagPreferenceRepository>(
            new TagPreferenceRepoImpl(getRequesterImpl()),
            newLocalTagPreferenceRepository(),
            ['get']
        ),
    createPomodoroRepository: () =>
        withMirrorFallback<PomodoroRepository>(
            newPomodoroRepository(getRequesterImpl()),
            newLocalPomodoroRepository(),
            ['get', 'list']
        ),
    createPomodoroRecordRepository: () =>
        withMirrorFallback<PomodoroRecordRepository>(
            newPomodoroRecordRepository(getRequesterImpl()),
            newLocalPomodoroRecordRepository(),
            ['get', 'list']
        )
}