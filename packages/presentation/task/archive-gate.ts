import { t } from '@nao-todo/shared/locales'
import { unwrapError } from '@nao-todo/shared/utils/user-facing-go-error'
import type { GoError } from '@nao-todo/shared/types'
import { NueMessage } from 'nue-ui'
import type { WriteMethodMap, WriteReturnShape } from '../offline/write-gate'

/**
 * 归档态只读守卫（ADR `2026-09-24-project-archive.md` §15.3 / Q6 / DP-4）
 *
 * @description 归档清单下的任务**全部写方法被拒**（含 URL 直达），**唯一例外 = 单任务 `unarchive`**。
 *              本模块同时承载**项目域（清单自身）**的同型守卫：`PROJECT_ARCHIVE_WRITE_METHODS` +
 *              `createProjectArchivedTargetJudge`（§7.2「清单自身 `update/delete/resort/archive`
 *              亦应拦截（除 `unarchive`）」）—— 守卫与错误码**单一实现**，两个域只各配「写方法清单 + 判据」。
 *              **不复用** `offline/write-gate.ts` 的 `OFFLINE_READONLY`（语义不同，避免混淆离线只读）；
 *              仅**复用其类型** `WriteMethodMap` / `WriteReturnShape`。
 *
 *              拦截语义：
 *              - 判据 = `options.isArchivedTarget(method, args)` 为真（读任务/清单 `archivedAt` 非空）；
 *              - 命中 ⇒ 按原方法形态返回 `ARCHIVED_READONLY`（`'error'` 直返 / `'tuple'` = `[null, …]`）
 *                + **可见提示**（`NueMessage.warn`）；**不调用原方法** ⇒ 仓储零写入；
 *              - `options.allow` 默认 `['unarchive']`（归档目标上唯一允许的写方法）；
 *              - 读方法与非写方法原样透传；非归档目标按判据驱动正常执行（不误伤）。
 *
 *              错误码为稳定字符串（`ARCHIVED_READONLY`），调用方**不得**依赖文案判定。
 */

/** 归档只读错误码（稳定标识；不随文案变化） */
export const ARCHIVED_READONLY_ERROR = 'ARCHIVED_READONLY'

/**
 * 是否归档只读守卫产出的错误（稳定码判定）
 * @description `T191`：`ARCHIVED_READONLY` 的**唯一用户可见提示**来自守卫
 *              （`archive.readOnlyHint`，本地化，见 `notifyArchivedReadOnly`）⇒ 通知层命中该码时
 *              **跳过提示**（不再提示、也不透出原始错误码）；该码本身仍**原样返回**调用方
 *              （机器判定/测试/调用方分支用）⇒ 本判定**只约束展示、不约束返回值**。
 *              仅按稳定码判定 ⇒ 不误伤其它错误码（`OFFLINE_READONLY` 等行为不变）；
 *              全仓唯一产出点 = 本模块守卫 `archivedReadOnlyResult`。
 */
export const isArchivedReadOnlyError = (err: unknown): boolean =>
    unwrapError(err as GoError) === ARCHIVED_READONLY_ERROR

/** 归档目标判据：由装配层提供（读任务 `archivedAt` 非空 ⇒ true） */
export type ArchivedTargetJudge = (method: string, args: unknown[]) => Promise<boolean>

/** 守卫选项 */
export type ArchivedReadOnlyGuardOptions = {
    /** 允许的写方法例外集（默认 `['unarchive']` —— 唯一例外） */
    allow?: readonly string[]
    /** 归档目标判据 */
    isArchivedTarget: ArchivedTargetJudge
}

/** 可见提示节流窗口（ms）：连续写只提示一次，避免刷屏（与离线闸门同型） */
const NOTICE_THROTTLE_MS = 1200

let lastNoticeAt = 0

/** 弹出「归档只读」可见提示（节流；供 UI 主动提示复用） */
export const notifyArchivedReadOnly = (): void => {
    const now = Date.now()
    if (now - lastNoticeAt < NOTICE_THROTTLE_MS) return
    lastNoticeAt = now
    NueMessage.warn(t('archive.readOnlyHint'))
}

/** 重置提示节流（**仅测试**） */
export const resetArchiveGateForTest = (): void => {
    lastNoticeAt = 0
}

/** 构造只读错误返回值（按原方法形态） */
const archivedReadOnlyResult = (shape: WriteReturnShape): unknown =>
    shape === 'tuple' ? [null, ARCHIVED_READONLY_ERROR] : ARCHIVED_READONLY_ERROR

/**
 * 以归档态只读守卫包装用例实例
 * @description 仅拦截 `writeMethods` 列出且不在 `allow` 中的方法；其余方法原样透传（含所有读方法）。
 *              返回 Proxy，类型与入参一致，调用方无感。
 * @param useCase 用例实例
 * @param writeMethods 写方法清单（方法名 → 返回形态）
 * @param options 例外集 + 归档目标判据
 */
export const withArchivedReadOnlyGuard = <T extends object>(
    useCase: T,
    writeMethods: WriteMethodMap,
    options: ArchivedReadOnlyGuardOptions
): T => {
    const writeShapes = new Map(Object.entries(writeMethods))
    const allow = new Set(options.allow ?? ['unarchive'])

    return new Proxy(useCase, {
        get(target, property) {
            const value = Reflect.get(target, property, target) as unknown
            if (typeof value !== 'function') return value

            const method = String(property)
            const shape = writeShapes.get(method)
            if (shape === undefined || allow.has(method)) {
                return (value as (...args: unknown[]) => unknown).bind(target)
            }

            return async (...args: unknown[]): Promise<unknown> => {
                const archived = await options.isArchivedTarget(method, args)
                if (!archived) return (value as (...args: unknown[]) => unknown).apply(target, args)
                notifyArchivedReadOnly()
                return archivedReadOnlyResult(shape)
            }
        }
    }) as T
}

/**
 * 任务用例归档守卫作用面（写方法清单）
 * @description 与离线闸门历史清单同形；**唯一例外 `unarchive`** 由 `allow` 默认值承载（不列入本表亦可，
 *              列入则在 `allow` 显式覆盖时会被拦截 ⇒ 与 ADR §15.3「allow 可覆盖」语义一致）。
 */
export const TASK_ARCHIVE_WRITE_METHODS: WriteMethodMap = {
    create: 'tuple',
    update: 'error',
    delete: 'error',
    restore: 'error',
    batchUpdate: 'tuple',
    resort: 'error',
    copy: 'tuple',
    snooze: 'error',
    unarchive: 'error'
}

/** 归档判定所需的读端口（装配层以仓储实现注入） */
export type TaskArchivedLookup = {
    /** 任务自身 `archivedAt` 是否非空 */
    isTaskArchived: (taskId: string) => Promise<boolean>
    /** 任务所属清单 `archivedAt` 是否非空 */
    isProjectArchived: (projectId: string) => Promise<boolean>
}

/**
 * 构造任务用例的归档目标判据（两端同一实现 ⇒ web/desktop 行为一致）
 * @description 按方法入参形态取目标：
 *              - `create(vo)` ⇒ 判 `vo.projectId` 所属清单归档；
 *              - `batchUpdate(updates)` ⇒ 任一目标任务归档即拦截；
 *              - 其余（`update/delete/restore/resort/copy/snooze/unarchive`）⇒ 首参任务 ID。
 */
export const createTaskArchivedTargetJudge =
    (lookup: TaskArchivedLookup): ArchivedTargetJudge =>
    async (method: string, args: unknown[]): Promise<boolean> => {
        if (method === 'create') {
            const projectId = (args[0] as { projectId?: string } | undefined)?.projectId
            return projectId ? await lookup.isProjectArchived(projectId) : false
        }
        if (method === 'batchUpdate') {
            const updates = Array.isArray(args[0]) ? (args[0] as Array<{ id?: string }>) : []
            const flags = await Promise.all(
                updates.map((update) =>
                    update?.id ? lookup.isTaskArchived(update.id) : Promise.resolve(false)
                )
            )
            return flags.some(Boolean)
        }
        const taskId = typeof args[0] === 'string' ? args[0] : ''
        return taskId ? await lookup.isTaskArchived(taskId) : false
    }

/** 项目归档判定所需的读端口（装配层以仓储实现注入） */
export type ProjectArchivedLookup = {
    /** 清单自身 `archivedAt` 是否非空 */
    isProjectArchived: (projectId: string) => Promise<boolean>
}

/**
 * 构造项目用例的归档目标判据（两端同一实现 ⇒ web/desktop 行为一致）
 * @description 项目域写方法均以**首参清单 ID** 为目标（`update/delete/restore/archive/resort/...`）
 *              ⇒ 取首参判该清单归档；非字符串首参（不该出现）判非归档（不误伤）。
 */
export const createProjectArchivedTargetJudge =
    (lookup: ProjectArchivedLookup): ArchivedTargetJudge =>
    async (_method: string, args: unknown[]): Promise<boolean> => {
        const projectId = typeof args[0] === 'string' ? args[0] : ''
        return projectId ? await lookup.isProjectArchived(projectId) : false
    }

/**
 * 项目用例归档守卫作用面（写方法清单）
 * @description ADR §7.2「清单自身 `update/delete/resort/archive`（幂等）亦应拦截（除 `unarchive`）」：
 *              - 项目域**写方法均为 `'error'` 形态**（`GoAsync<void>` = `GoError`）⇒ 本域**无 `'tuple'` 落点**
 *                （`createProject` 虽为 tuple，但无归档目标可判 ⇒ 不列入）；
 *              - **`archive` 不列入 `allow`**：对已归档清单再调 `archive` 是**幂等**，但仍是写路径、
 *                ADR 明列其应拦截 ⇒ 保持「**唯一放行口 = `unarchive`**」，不新增第二个写旁路；
 *              - **`saveProjectPreference` 不列入**：偏好面 = 视图显示配置（列/排序/状态筛选），非清单业务数据，
 *                且与「离线闸门明确豁免偏好面」同理；列入会破坏**只读查看时**的视图配置保存（不误伤红线）；
 *              - `restore` 与 `resortSingle` / `resortWithRebuild` 为公开写方法 ⇒ 一并纳入（判据同形）。
 */
export const PROJECT_ARCHIVE_WRITE_METHODS: WriteMethodMap = {
    update: 'error',
    delete: 'error',
    restore: 'error',
    archive: 'error',
    unarchive: 'error',
    resort: 'error',
    resortSingle: 'error',
    resortWithRebuild: 'error'
}