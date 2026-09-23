import type { AuthUseCase, UserUseCase } from '@nao-todo/domain-identity'
import type { PomodoroRecordRepository, PomodoroRepository } from '@nao-todo/domain-pomodoro'
import type { ProjectPreferenceRepository, ProjectRepository } from '@nao-todo/domain-project'
import type { TagPreferenceRepository, TagRepository } from '@nao-todo/domain-tag'
import type {
    TaskCheckItemRepository,
    TaskCommentRepository,
    TaskRepository
} from '@nao-todo/domain-task'
import { ProjectRepoImpl } from '@nao-todo/infrastructure/src/persistence-go/project/project-repo-impl'
import { TagPreferenceRepoImpl } from '@nao-todo/infrastructure/src/persistence-go/tag/tag-preference'
import { TagRepoImpl } from '@nao-todo/infrastructure/src/persistence-go/tag/tag'
import { TaskCheckItemRepoImpl } from '@nao-todo/infrastructure/src/persistence-go/task/task-check-item-repo-impl'
import { TaskCommentRepoImpl } from '@nao-todo/infrastructure/src/persistence-go/task/task-comment-repo-impl'
import { TaskRepoImpl } from '@nao-todo/infrastructure/src/persistence-go/task/task-repo-impl'
import { newLocalPomodoroRecordRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/pomodoro-record-repo-impl'
import { newLocalPomodoroRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/pomodoro-repo-impl'
import { newLocalProjectPreferenceRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/project-preference-repo-impl'
import { newLocalProjectRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/project-repo-impl'
import { newLocalTagPreferenceRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/tag-preference-repo-impl'
import { newLocalTagRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/tag-repo-impl'
import { newLocalTaskCheckItemRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/task-check-item-repo-impl'
import { newLocalTaskCommentRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/task-comment-repo-impl'
import { newLocalTaskRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/task-repo-impl'
import { newPomodoroRecordRepository } from '@nao-todo/infrastructure/src/persistence-go/pomodoro/pomodoro-record-repo-impl'
import { newPomodoroRepository } from '@nao-todo/infrastructure/src/persistence-go/pomodoro/pomodoro-repo-impl'
import { withMirrorFallback } from '@nao-todo/infrastructure/src/persistence-go/fallback/mirror-fallback'
import { getRequesterImpl } from '@nao-todo/shared/requester'
import {
    POMODORO_RECORD_WRITE_METHODS,
    POMODORO_WRITE_METHODS,
    PROJECT_WRITE_METHODS,
    TAG_WRITE_METHODS,
    TASK_CHECK_ITEM_WRITE_METHODS,
    TASK_COMMENT_WRITE_METHODS,
    TASK_WRITE_METHODS,
    USER_WRITE_METHODS,
    withReadOnlyGuard,
    type WriteMethodMap
} from '@nao-todo/presentation/offline'

/**
 * 用例装配绑定（端差异唯一注入点）
 * @description 共享用例（`apps/web/src/hooks/usecases/**`）统一经 `@/hooks/usecases/binding`
 *              读取本模块：web 构建解析到本文件，desktop 构建经
 *              `electron.vite.config.ts` 的 `@/hooks` 别名（先于 `@` 命中）解析到 desktop 侧同名文件
 *              （本地仓储）。业务数据仓储在此注入；认证/用户用例的端专属装饰（本地解锁、
 *              注销调度、密钥重包）经 `decorateAuthUseCase` / `decorateUserUseCase` 注入（web 端不提供）。
 *
 *              **web 业务数据读路径 = 远端优先 + 网络类失败回退本地镜像**（C-66 / AC8）：业务远端仓储为**主读**，
 *              由 `withMirrorFallback` 装饰（只包装读方法）；业务写路径保持远端直连（不新增本地写路径）。
 *              **偏好/设置面为显式例外**（TASK-26 / PS-1a / PS-1b，ADR-r2 §D-1）：两端**同构本地优先** ——
 *              `createProjectPreferenceRepository` 直接用**本地仓储**（web 不再「远端优先」，否则本地刚写入的值
 *              会被远端陈旧值覆盖）；偏好回传走**独立偏好队列**（`persistence-sync/preference-sync`）。
 *              **web 离线只读闸门（C-59 / AC10，ADR-r5）经 `decorateUseCase` 注入 —— web-only**：
 *              desktop 侧 binding 不提供该钩子 ⇒ 桌面写路径（在线/离线）**逐字不变**。
 *              本地镜像由 `@/data-plane` 后台启动的 `syncService` 填充。
 */

/** 用例种类（端专属装饰的路由键） */
export type UseCaseKind =
    | 'task'
    | 'task-check-item'
    | 'task-comment'
    | 'project'
    | 'tag'
    | 'pomodoro'
    | 'pomodoro-record'
    | 'user'

/** web 离线只读写方法清单（按用例种类；ADR-r5：仅 web 拦截） */
const WRITE_METHODS_BY_KIND: Record<UseCaseKind, WriteMethodMap> = {
    task: TASK_WRITE_METHODS,
    'task-check-item': TASK_CHECK_ITEM_WRITE_METHODS,
    'task-comment': TASK_COMMENT_WRITE_METHODS,
    project: PROJECT_WRITE_METHODS,
    tag: TAG_WRITE_METHODS,
    pomodoro: POMODORO_WRITE_METHODS,
    'pomodoro-record': POMODORO_RECORD_WRITE_METHODS,
    user: USER_WRITE_METHODS
}

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
    /**
     * 用例装饰（端专属）
     * @description **web 提供**：套 `withReadOnlyGuard`（离线只读闸门，C-59 / AC10）；
     *              **desktop 不提供** ⇒ 共享工厂原样返回用例 ⇒ 桌面写路径（在线/离线）逐字不变。
     */
    decorateUseCase?: <T extends object>(useCase: T, kind: UseCaseKind) => T
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
    createProjectPreferenceRepository: () => newLocalProjectPreferenceRepository(),
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
        ),
    // C-59 / AC10（ADR-r5）：**web-only** 离线只读闸门；desktop binding 不提供本钩子
    decorateUseCase: (useCase, kind) => withReadOnlyGuard(useCase, WRITE_METHODS_BY_KIND[kind])
}