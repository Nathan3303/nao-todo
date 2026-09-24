import { t } from '@nao-todo/shared/locales'
import { NueMessage } from 'nue-ui'
import type { WriteMethodMap, WriteReturnShape } from '../offline/write-gate'

/**
 * 归档态只读守卫（ADR `2026-09-24-project-archive.md` §15.3 / Q6 / DP-4）
 *
 * @description 归档清单下的任务**全部写方法被拒**（含 URL 直达），**唯一例外 = 单任务 `unarchive`**。
 *              **不复用** `offline/write-gate.ts` 的 `OFFLINE_READONLY`（语义不同，避免混淆离线只读）；
 *              仅**复用其类型** `WriteMethodMap` / `WriteReturnShape`。
 *
 *              拦截语义：
 *              - 判据 = `options.isArchivedTarget(method, args)` 为真（读任务 `archivedAt` 非空）；
 *              - 命中 ⇒ 按原方法形态返回 `ARCHIVED_READONLY`（`'error'` 直返 / `'tuple'` = `[null, …]`）
 *                + **可见提示**（`NueMessage.warn`）；**不调用原方法** ⇒ 仓储零写入；
 *              - `options.allow` 默认 `['unarchive']`（归档任务上唯一允许的写方法）；
 *              - 读方法与非写方法原样透传；非归档目标按判据驱动正常执行（不误伤）。
 *
 *              错误码为稳定字符串（`ARCHIVED_READONLY`），调用方**不得**依赖文案判定。
 */

/** 归档只读错误码（稳定标识；不随文案变化） */
export const ARCHIVED_READONLY_ERROR = 'ARCHIVED_READONLY'

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