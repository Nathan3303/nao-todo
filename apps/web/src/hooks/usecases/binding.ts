import type { AuthUseCase, UserUseCase } from '@nao-todo/domain-identity'
import type { PomodoroRecordRepository, PomodoroRepository } from '@nao-todo/domain-pomodoro'
import type { ProjectPreferenceRepository, ProjectRepository } from '@nao-todo/domain-project'
import type { TagPreferenceRepository, TagRepository } from '@nao-todo/domain-tag'
import type {
    TaskCheckItemRepository,
    TaskCommentRepository,
    TaskRepository
} from '@nao-todo/domain-task'
import { TagPreferenceRepoImpl } from '@nao-todo/infrastructure/src/persistence-go/tag/tag-preference'
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
 *              **web 业务数据面（阶段二 2A 按域切本地，ADR `2026-09-24-stage2-both-ends-local-first`）**：
 *              - **任务域（W1）+ 子实体域（W2：检查项 / 评论）+ 容器域（W3：清单 / 标签）**：
 *                仓储 = **本地仓储**（与 desktop 同构），读写均本地优先；本地写经 `syncTracker.markDirty`
 *                入 `syncQueue` 回传（PS-12）⇒ **这些域离线写闸门已撤**。
 *              - **其余 2 域（W4 待切：番茄 / 番茄记录）**：读 = 远端优先 +
 *                网络类失败回退本地镜像（`withMirrorFallback`，C-66 / AC8）；写 = 远端直连，仍受离线写闸门约束。
 *              **偏好/设置面为显式例外**（TASK-26 / PS-1a / PS-1b，ADR-r2 §D-1）：两端**同构本地优先** ——
 *              `createProjectPreferenceRepository` 直接用**本地仓储**（web 不再「远端优先」，否则本地刚写入的值
 *              会被远端陈旧值覆盖）；偏好回传走**独立偏好队列**（`persistence-sync/preference-sync`）。
 *              **web 离线只读闸门（C-59 / AC10，ADR-r5）经 `decorateUseCase` 注入 —— web-only**：
 *              desktop 侧 binding 不提供该钩子 ⇒ 桌面写路径（在线/离线）**逐字不变**；
 *              **已切本地优先的域不再套闸门**（`LOCAL_FIRST_KINDS`，ADR §5 M4/M5「撤该域闸门」）。
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

/**
 * 已切本地优先（local-first）的域 —— 该域离线写闸门已撤（ADR §5 M4「撤该域闸门」）
 * @description 阶段二 2A 按域推进（W1 任务 → W2 子实体 → W3 容器 → W4 番茄；W5 身份不切）。
 *              切本地后写路径为「本地仓储 + `syncQueue` 回传」（PS-12）⇒ 离线写合法，**不得**再被只读闸门拦截。
 */
const LOCAL_FIRST_KINDS: ReadonlySet<UseCaseKind> = new Set<UseCaseKind>([
    'task',
    'task-check-item',
    'task-comment',
    'project',
    'tag'
])

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
     * @description **web 提供**：未切本地优先的域套 `withReadOnlyGuard`（离线只读闸门，C-59 / AC10）；
     *              已切本地优先的域（`LOCAL_FIRST_KINDS`）**不套闸门**（ADR §5 M4/M5）；
     *              **desktop 不提供** ⇒ 共享工厂原样返回用例 ⇒ 桌面写路径（在线/离线）逐字不变。
     */
    decorateUseCase?: <T extends object>(useCase: T, kind: UseCaseKind) => T
}

/** web 端绑定：任务域（W1）+ 子实体域（W2）+ 容器域（W3）已切本地仓储；其余 2 域仍远端主读 + 网络类失败回退本地镜像 */
export const useCaseBinding: UseCaseBinding = {
    createTaskRepository: () => newLocalTaskRepository(),
    createTaskCheckItemRepository: () => newLocalTaskCheckItemRepository(),
    createTaskCommentRepository: () => newLocalTaskCommentRepository(),
    createProjectRepository: () => newLocalProjectRepository(),
    createProjectPreferenceRepository: () => newLocalProjectPreferenceRepository(),
    createTagRepository: () => newLocalTagRepository(),
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
    // 阶段二 2A：已切本地优先的域撤闸门（ADR §5 M4/M5），其余域照旧
    decorateUseCase: (useCase, kind) =>
        LOCAL_FIRST_KINDS.has(kind)
            ? useCase
            : withReadOnlyGuard(useCase, WRITE_METHODS_BY_KIND[kind])
}