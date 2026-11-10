// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import {
    CreateTaskValueObject,
    UpdateTaskValueObject,
    type TaskEntity
} from '@nao-todo/domain-task'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { taskRecordToEntity } from '../../persistence-local/converters/task'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import { loadConflictJournal, type ConflictJournalEntry } from '../conflict-journal'
import { syncStatus } from '../sync-status'
import { syncTracker } from '../sync-tracker'
import { SyncService } from '../sync-service'

/**
 * T675 · 字段级合并（Issue #340 / B 批 M0）**红基线共享夹具**
 *
 * 设计约束（与 `t671` 同理，避免「测的是假服务端」）：
 * - 真实本地仓储（`newLocalTaskRepository`）+ 真实 `syncQueue` + 真实 `conflict-journal`；
 * - 假服务端**只**模拟服务端契约（行级 OCC = `baseUpdatedAt == updatedAt`、`stale` 回执带
 *   `serverCurrent`、pull keyset 游标），**不参与任何产品判定**；
 * - 时间：远端行时间固定落在 `BASE_TIME` 附近，本地写入用真实时钟（远晚于 `BASE_TIME`）
 *   ⇒ pull 默认落在既有「本地胜（A1）」分支；需要「远端胜」时用 `setRemote(..., at)` 显式给未来时间。
 *
 * ⛔ 本文件不含断言语义，只提供夹具；每个 `it` 的断言仍写在各自测试文件里。
 */

export const USER_ID = 't675-field-merge-user'
export const BASE_TIME = '2026-02-01T00:00:00.000Z'
/** 远端行时间「晚于本地写入」的显式口径（用于构造 remote-wins 分支） */
export const FUTURE_REMOTE_TS = '2030-01-01T00:00:00.000Z'

export type RawRecord = Record<string, unknown>

const EMPTY_TABLE = { items: [], total: 0, nextCursor: '', nextCursorId: '' }

export interface FakeServer {
    requester: Requester
    rows: Map<string, RawRecord>
    /** 每次 `/sync/push` 的请求体（断言推送载荷用） */
    pushBodies: RawRecord[]
    setRemote: (id: string, patch: RawRecord, at?: string) => string
    row: (id: string) => RawRecord | undefined
}

/** 最小假服务端：行级 OCC + applied/stale + serverCurrent + pull keyset（字段形状与真实后端同形） */
export const makeServer = (): FakeServer => {
    const rows = new Map<string, RawRecord>()
    const pushBodies: RawRecord[] = []
    let seq = 0
    const tick = (): string =>
        new Date(Date.parse(BASE_TIME) + 60_000 + (seq += 1) * 1000).toISOString()

    const pullInner = (body: unknown): unknown => {
        const cursor = (body as { tasks?: { updatedAt?: string } }).tasks?.updatedAt ?? ''
        const cursorTs = Date.parse(cursor) || 0
        const items = [...rows.values()].filter(
            (row) => (Date.parse(String(row.updatedAt)) || 0) > cursorTs
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
            // 服务端 owned / 分配字段：真实后端总会回填（本地 0/空）⇒ 夹具补齐，
            // 否则 `pickChangedFields` 会把「服务端缺字段 vs 本地 0」误判成业务差异（口径噪声）。
            const merged: RawRecord = {
                ...current,
                ...payload,
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

    return {
        requester: {
            post,
            get: vi.fn(async () => ({ data: {} })),
            put: vi.fn(async () => ({ data: {} })),
            delete: vi.fn(async () => ({ data: {} }))
        } as unknown as Requester,
        rows,
        pushBodies,
        setRemote: (id, patch, at) => {
            const next: RawRecord = {
                ...rows.get(id),
                ...patch,
                updatedAt: at ?? tick()
            }
            rows.set(id, next)
            return String(next.updatedAt)
        },
        row: (id) => rows.get(id)
    }
}

/** 清空全部本地表 + 重建会话 / 加密上下文（每个 `it` 前置调用） */
export const resetLocalState = async (): Promise<void> => {
    await localDatabase.projects.clear()
    await localDatabase.projectPreferences.clear()
    await localDatabase.tags.clear()
    await localDatabase.tagPreferences.clear()
    await localDatabase.tasks.clear()
    await localDatabase.taskCheckItems.clear()
    await localDatabase.taskComments.clear()
    await localDatabase.pomodoros.clear()
    await localDatabase.pomodoroRecords.clear()
    await localDatabase.users.clear()
    await localDatabase.userConfigs.clear()
    await localDatabase.meta.clear()
    await localDatabase.deletionSchedules.clear()
    await localDatabase.syncQueue.clear()
    await localDatabase.syncCursor.clear()
    localStorage.clear()
    cryptoService.lock()
    localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-t675-fixture')
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
    syncStatus.setConflictCount(0)
}

export interface TaskSeed {
    name?: string
    description?: string
    state?: string
    priority?: string
    startAt?: string | null
    endAt?: string | null
    projectId?: string
    tags?: string[]
    remindAt?: string | null
    remindRepeat?: string
    remindTime?: string | null
    remindWeekdays?: number[]
}

const newTaskEntity = (seed: TaskSeed): CreateTaskValueObject =>
    new CreateTaskValueObject(
        null,
        null,
        seed.name ?? 'A0-name',
        seed.description ?? 'A0-desc',
        seed.state ?? 'todo',
        seed.priority ?? 'medium',
        seed.startAt ?? null,
        seed.endAt ?? null,
        seed.projectId ?? 'project-1',
        seed.tags ?? [],
        seed.remindAt ?? null,
        seed.remindRepeat ?? 'none',
        seed.remindTime ?? null,
        seed.remindWeekdays ?? []
    )

/**
 * 初始同步态：本地建任务 → 首次 push 到假服务端（本地 `syncedServerUpdatedAt` = 服务端版本）
 * @returns 任务 id；`journal` 必须为空（否则夹具本身不可信）
 */
export const createSyncedTask = async (
    server: FakeServer,
    seed: TaskSeed = {}
): Promise<string> => {
    const [task, err] = await newLocalTaskRepository().create(newTaskEntity(seed))
    if (err !== null) throw new Error(`夹具建任务失败: ${err}`)
    const id = (task as TaskEntity).id
    await new SyncService(server.requester).pushAll()
    const entries = await loadConflictJournal(USER_ID)
    if (entries.length !== 0) throw new Error('夹具初始同步产生了冲突记录（夹具不可信）')
    return id
}

/** 本地写（真实仓储写路径：加密 + 行写入 + 入队同一事务；字段级基准捕获的落点） */
export const patchLocal = async (id: string, patch: TaskSeed): Promise<void> => {
    const vo = new UpdateTaskValueObject(id)
    for (const [field, value] of Object.entries(patch)) {
        ;(vo as unknown as Record<string, unknown>)[field] = value
    }
    const err = await newLocalTaskRepository().update(id, vo)
    if (err !== null) throw new Error(`夹具本地写失败: ${err}`)
}

/** 本地删（墓碑写入 + 入队） */
export const removeLocal = async (id: string): Promise<void> => {
    const err = await newLocalTaskRepository().remove(id)
    if (err !== null) throw new Error(`夹具本地删除失败: ${err}`)
}

/** 本地行（解密后的实体；时间戳空串已归一为 null） */
export const readLocal = async (id: string): Promise<TaskEntity> => {
    const record = await localDatabase.tasks.get(id)
    if (!record) throw new Error(`本地行不存在: ${id}`)
    return await taskRecordToEntity(record)
}

/** 本地原始行（断言 base / 加密存储用） */
export const readLocalRaw = async (id: string): Promise<RawRecord> => {
    const record = await localDatabase.tasks.get(id)
    if (!record) throw new Error(`本地行不存在: ${id}`)
    return record as unknown as RawRecord
}

/** 冲突记账（真实 journal） */
export const readJournal = (): Promise<ConflictJournalEntry[]> => loadConflictJournal(USER_ID)

/** 待推送队列条数（真实 syncQueue） */
export const countQueue = (): Promise<number> => syncTracker.countDirty(USER_ID)

export const makeService = (server: FakeServer): SyncService => new SyncService(server.requester)