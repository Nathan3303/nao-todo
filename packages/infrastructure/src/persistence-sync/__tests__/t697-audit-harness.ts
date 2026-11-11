// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { expect, vi } from 'vite-plus/test'
import type { Table } from 'dexie'
import type { Requester } from '@nao-todo/shared'
import {
    clearStructuredLog,
    readStructuredLog,
    type StructuredLogEntry
} from '../../observability/structured-log'
import { localDatabase } from '../../persistence-local/db/local-database'
import { resetLocalState as resetBaseState, BASE_TIME, USER_ID } from './t675-field-merge-harness'

/**
 * T697 · A 档审计日志（Issue #346 / M0）**红基线共享夹具 + 测试侧探针**
 *
 * 设计约束（与 `t675` 同源，避免「测的是假服务端」与「测的是自己写的假实现」）：
 * - 真实本地仓储（`newLocalTaskRepository`）+ 真实 `syncQueue` + 真实 `SyncService`；
 * - **不 import 被测模块** `persistence-sync/audit-log.ts`（M0 时它尚不存在 ⇒ 会变成
 *   「模块不存在 / 收集失败」的弱红，PM 明令禁止）⇒ 改用**测试侧探针** `readAudit()`：
 *   表不存在时返回 `[]`，让每条断言都以 **AC 级强红因**（`expected N entries, got 0`）失败；
 *   表存在时按真实表内容读（M1 落地后用例自动转绿）。
 * - 假服务端**只**模拟服务端契约：pull keyset / 行级 OCC / `stale` + `serverCurrent` /
 *   收集箱隐式桶归一（`projectId === ''` ⇒ `userId`）。不参与任何产品判定。
 *
 * ⛔ 本文件不含 AC 断言语义（只提供夹具 / 探针 / 常量），断言写在各自测试文件里。
 * @see docs/prds/2026-11-10-audit-log.md（R-1…R-9 / AC1–AC11）
 * @see docs/reports/T696-audit-log-arch-review.md（§2.1 表结构 / §4 防刷屏 / §8 有界 / §10 红基线）
 */

export { BASE_TIME, USER_ID }

/** 审计表名（ADR D1：同库新表，Dexie `version(5)` 只增表） */
export const AUDIT_TABLE = 'auditLogs'

/** 来源四值（R-4：固定，⛔ 不新增） */
export const AUDIT_SOURCES = ['local-edit', 'pull', 'push-merge', 'conflict-retry'] as const

/** 动作枚举（ADR §2.1） */
export const AUDIT_ACTIONS = [
    'create',
    'update',
    'archive',
    'unarchive',
    'delete',
    'restore'
] as const

/** 有界参数（R-5 / AC6 / arch §8.1） */
export const AUDIT_LIMIT = 1000
export const AUDIT_RETENTION_DAYS = 90
export const AUDIT_ENTRY_BYTE_BUDGET = 1024
/** 单值文本截断上限（复用 journal 口径，⛔ 另造字面量） */
export const AUDIT_VALUE_TEXT_LIMIT = 512

/**
 * 审计条目形状（**测试侧期望形状**，源自 arch §2.1）
 * @description 只声明本档断言用到的字段；实现多出字段不影响断言（不逐字全等对象）。
 */
export interface AuditFieldDiff {
    field: string
    from: unknown
    to: unknown
}

export interface AuditRow {
    seq?: number
    userId: string
    entity: string
    entityId: string
    action: string
    source: string
    fields: AuditFieldDiff[]
    at: string
    truncated?: boolean
    truncatedFields?: string[]
}

/** 当前打开版本的库内表名（Dexie 未 open 时为空） */
export const tableNames = (): string[] => localDatabase.tables.map((table) => table.name)

/** `auditLogs` 是否存在于当前 schema（AC5「表存在」/ 变异 7 的判据） */
export const auditTableExists = (): boolean => tableNames().includes(AUDIT_TABLE)

/**
 * 取审计表（**存在性前置断言**）
 * @description 用于必须直连表造数/断言的用例（迁移、有界）。表缺失时给出**显式 AC 断言红**
 *              （`审计表 auditLogs 不存在`），而不是抛 `Table not found` 的弱错误。
 */
export const requireAuditTable = (): Table<AuditRow, number> => {
    expect(auditTableExists(), `审计表 ${AUDIT_TABLE} 不存在（ADR D1：version(5) 只增表）`).toBe(
        true
    )
    return localDatabase.table(AUDIT_TABLE) as Table<AuditRow, number>
}

/** 读审计（表缺失 ⇒ `[]`；按 `seq` 升序 = 插入序） */
export const readAudit = async (userId: string = USER_ID): Promise<AuditRow[]> => {
    if (!auditTableExists()) return []
    const rows = (await (
        localDatabase.table(AUDIT_TABLE) as Table<AuditRow, number>
    ).toArray()) as AuditRow[]
    return rows
        .filter((row) => row.userId === userId)
        .sort((left, right) => (left.seq ?? 0) - (right.seq ?? 0))
}

/** 某用户的审计条数（表缺失 ⇒ 0） */
export const countAudit = async (userId: string = USER_ID): Promise<number> =>
    (await readAudit(userId)).length

/** 清审计（表缺失 ⇒ no-op） */
export const clearAudit = async (): Promise<void> => {
    if (!auditTableExists()) return
    await (localDatabase.table(AUDIT_TABLE) as Table<AuditRow, number>).clear()
}

/** 每个 `it` 的前置：重置业务态 + 清审计 + 清结构化日志 */
export const resetAuditState = async (): Promise<void> => {
    await resetBaseState()
    await clearAudit()
    clearStructuredLog()
}

/** 结构化日志事件名序列（AC4 / AC16 用） */
export const structuredEvents = (): string[] => readStructuredLog().map((entry) => entry.event)

/** 结构化日志原文（断言「不含业务值」用） */
export const structuredLogRaw = (): readonly StructuredLogEntry[] => readStructuredLog()

// ---------------------------------------------------------------------------
// 假服务端（服务端契约的最小仿真）
// ---------------------------------------------------------------------------

const EMPTY_TABLE = { items: [], total: 0, nextCursor: '', nextCursorId: '' }

export type RawRecord = Record<string, unknown>

export interface AuditFakeServer {
    requester: Requester
    rows: Map<string, RawRecord>
    /**
     * `true` ⇒ **每轮忽略游标返回全部行**
     * @description 模拟 `DEF-147`：每轮 pull 从 `cursor-1s` 回拉、`applyPullBatch`
     *              在「本地未改」分支**无条件 `put`** ⇒ 回拉窗口内的未变化行每轮都被重写。
     */
    replay: boolean
    /** 每次 `/sync/pull` 的请求体（断言游标行为用） */
    pullBodies: RawRecord[]
    /** 每次 `/sync/push` 的请求体 */
    pushBodies: RawRecord[]
    setRow: (id: string, patch: RawRecord, at?: string) => string
    /** 与 `t675` 夹具同名的别名（结构兼容，便于复用 `createSyncedTask`） */
    setRemote: (id: string, patch: RawRecord, at?: string) => string
    row: (id: string) => RawRecord | undefined
    /** 只推进服务端 `updatedAt`（业务内容不变）——「记录不同但业务等价」的最强形态 */
    bumpUpdatedAt: (id: string) => string
}

/**
 * 最小假服务端
 * @description 任务行形状与真实后端同形（含服务端 owned 的 3 个派生计数与 `sortId`）。
 *              `projectId === ''` ⇒ 落库为 `userId`（收集箱隐式桶，`sync-normalize` 读侧归一的真实来源）。
 */
export const makeAuditServer = (): AuditFakeServer => {
    const rows = new Map<string, RawRecord>()
    const pullBodies: RawRecord[] = []
    const pushBodies: RawRecord[] = []
    let seq = 0
    const tick = (): string =>
        new Date(Date.parse(BASE_TIME) + 60_000 + (seq += 1) * 1000).toISOString()

    const server: AuditFakeServer = {
        requester: null as unknown as Requester,
        rows,
        replay: false,
        pullBodies,
        pushBodies,
        setRow: (id, patch, at) => {
            const next: RawRecord = { ...rows.get(id), ...patch, updatedAt: at ?? tick() }
            rows.set(id, next)
            return String(next.updatedAt)
        },
        row: (id) => rows.get(id),
        setRemote: (id, patch, at) => server.setRow(id, patch, at),
        bumpUpdatedAt: (id) => server.setRow(id, {})
    }

    const pullInner = (body: unknown): unknown => {
        pullBodies.push((body ?? {}) as RawRecord)
        const cursor = (body as { tasks?: { updatedAt?: string } }).tasks?.updatedAt ?? ''
        const cursorTs = Date.parse(cursor) || 0
        const items = [...rows.values()].filter(
            (row) => server.replay || (Date.parse(String(row.updatedAt)) || 0) > cursorTs
        )
        return {
            data: {
                data: {
                    tasks: { items, total: items.length, nextCursor: '', nextCursorId: '' },
                    projects: EMPTY_TABLE,
                    tags: EMPTY_TABLE,
                    taskCheckItems: EMPTY_TABLE,
                    taskComments: EMPTY_TABLE,
                    pomodoros: EMPTY_TABLE,
                    pomodoroRecords: EMPTY_TABLE
                },
                serverTime: Date.now()
            }
        }
    }

    const pushInner = (body: unknown): unknown => {
        pushBodies.push((body ?? {}) as RawRecord)
        const items = (body as { tasks?: RawRecord[] }).tasks ?? []
        const results = items.map((item) => {
            const current = rows.get(String(item.id))
            if (current && item.baseUpdatedAt && item.baseUpdatedAt !== current.updatedAt) {
                return {
                    table: 'tasks',
                    id: String(item.id),
                    outcome: 'stale',
                    serverUpdatedAt: current.updatedAt,
                    serverCurrent: current
                }
            }
            const { baseUpdatedAt: _base, ...payload } = item
            const merged: RawRecord = {
                ...current,
                ...payload,
                // 收集箱隐式桶：服务端把空项目归一到 `userId`（`sync-normalize` 的对照面）
                ...(payload.projectId === '' || payload.projectId === undefined
                    ? { projectId: USER_ID }
                    : {}),
                updatedAt: tick(),
                checkItemCount: current?.checkItemCount ?? 0,
                commentCount: current?.commentCount ?? 0,
                subtaskCount: current?.subtaskCount ?? 0,
                sortId: payload.sortId ?? current?.sortId ?? 0
            }
            rows.set(String(item.id), merged)
            return {
                table: 'tasks',
                id: String(item.id),
                outcome: 'applied',
                serverUpdatedAt: merged.updatedAt
            }
        })
        return { data: { results }, serverTime: Date.now() }
    }

    const post = vi.fn(async (url: string, body: unknown) => ({
        data: url === '/sync/pull' ? pullInner(body) : url === '/sync/push' ? pushInner(body) : {}
    }))

    server.requester = {
        post,
        get: vi.fn(async () => ({ data: {} })),
        put: vi.fn(async () => ({ data: {} })),
        delete: vi.fn(async () => ({ data: {} }))
    } as unknown as Requester
    return server
}

/** 服务端任务行（真实后端同形；用于直接铺远端状态） */
export const remoteTaskRow = (overrides: RawRecord = {}): RawRecord => ({
    id: 'remote-task',
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
    deletedAt: null,
    parentTaskId: null,
    name: 'A0-name',
    description: 'A0-desc',
    state: 'todo',
    priority: 'medium',
    startAt: null,
    endAt: null,
    projectId: 'project-1',
    tags: [],
    archivedAt: null,
    starMarkAt: null,
    givenUpAt: null,
    remindAt: null,
    remindRepeat: 'none',
    remindTime: null,
    remindWeekdays: [],
    checkItemCount: 0,
    commentCount: 0,
    subtaskCount: 0,
    sortId: 0,
    ...overrides
})