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
import { withMirrorFallback } from '@nao-todo/infrastructure/src/persistence-go/fallback/mirror-fallback'
import { getRequesterImpl } from '@nao-todo/shared/requester'
import {
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
 *              - **业务 7 域全部切本地优先（W1 任务 / W2 子实体 / W3 容器 / W4 番茄）**：
 *                仓储 = **本地仓储**（与 desktop 同构），读写均本地优先；本地写经 `syncTracker.markDirty`
 *                入 `syncQueue` 回传（PS-12）⇒ **这些域离线写闸门已撤**。
 *              - **身份域（W5）不切**：`useUserUseCase` 的用户资料/账号操作仍**远端直连**（用户域不在业务数据面），
 *                仍受离线写闸门约束（ADR §2.6 W5；闸门组件退役属 M6，另行推进）。
 *              **偏好/设置面为显式例外**（TASK-26 / PS-1a / PS-1b，ADR-r2 §D-1）：两端**同构本地优先** ——
 *              `createProjectPreferenceRepository` 直接用**本地仓储**（web 不再「远端优先」，否则本地刚写入的值
 *              会被远端陈旧值覆盖）；偏好回传走**独立偏好队列**（`persistence-sync/preference-sync`）。
 *              **web 离线只读闸门（C-59 / AC10，ADR-r5）经 `decorateUseCase` 注入 —— web-only**：
 *              desktop 侧 binding 不提供该钩子 ⇒ 桌面写路径（在线/离线）**逐字不变**；
 *              **阶段二 2A M6 收敛：业务 7 域已全部切本地优先 ⇒ 闸门仅保留身份域 `user`**
 *              （ADR §5 M4/M5「撤该域闸门」+ M6「闸门收敛」）。
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

/**
 * web 离线只读写方法清单（按用例种类；ADR-r5：仅 web 拦截）
 * @description 阶段二 2A M6 收敛：业务 7 域（W1–W4）全部切本地优先 ⇒ 已从本表移除；
 *              **仅身份域 `user`（W5 不切、仍远端直连）保留** ⇒ 离线写仍被拦截。
 *              本表是「只读闸门作用域」的**唯一真源**（键缺失 = 该域不套闸门）。
 */
const WRITE_METHODS_BY_KIND: Partial<Record<UseCaseKind, WriteMethodMap>> = {
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
     * @description **web 提供**：`WRITE_METHODS_BY_KIND` 中的域（阶段二 2A M6 后**仅身份域 `user`**）
     *              套 `withReadOnlyGuard`（离线只读闸门，C-59 / AC10）；其余域（业务 7 域已切本地优先）
     *              **不套闸门**（ADR §5 M4/M5/M6）；
     *              **desktop 不提供** ⇒ 共享工厂原样返回用例 ⇒ 桌面写路径（在线/离线）逐字不变。
     */
    decorateUseCase?: <T extends object>(useCase: T, kind: UseCaseKind) => T
}

/** web 端绑定：业务 7 域（W1–W4）全部切本地仓储；身份域（W5）不切，仍远端直连 */
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
    createPomodoroRepository: () => newLocalPomodoroRepository(),
    createPomodoroRecordRepository: () => newLocalPomodoroRecordRepository(),
    // C-59 / AC10（ADR-r5）：**web-only** 离线只读闸门；desktop binding 不提供本钩子
    // 阶段二 2A M6：业务 7 域已切本地优先 ⇒ 闸门仅保留身份域 `user`（ADR §5 M4/M5/M6）
    decorateUseCase: (useCase, kind) => {
        const writeMethods = WRITE_METHODS_BY_KIND[kind]
        return writeMethods ? withReadOnlyGuard(useCase, writeMethods) : useCase
    }
}