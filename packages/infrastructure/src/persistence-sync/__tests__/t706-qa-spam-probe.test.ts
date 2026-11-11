// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { CreateTaskValueObject, UpdateTaskValueObject } from '@nao-todo/domain-task'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import { clearStructuredLog, readStructuredLog } from '../../observability/structured-log'
import { clearAudit, loadAudit, recordAudit } from '../audit-log'
import { syncStatus } from '../sync-status'
import { SyncService } from '../sync-service'

/**
 * T706 · A 档审计日志 **批末独立复验探针**（QA 自写；⛔ 不复用 `t697-*` / `t675` 夹具，也不采信 RD 自述）
 *
 * 立身之本 = **两个假刷屏源必须真被挡住**，且探针本身**有牙**（把归一/判等改坏就必须红）：
 * - P1 `DEF-147`：回拉窗口内未变化行每轮仍被 `put` ⇒ 审计必须 0 条（⛔ 不按 put 计数）；
 * - P2 `DEF-159`：收集箱桶（本地 `inbox` ↔ 服务端 `userId`）⇒ 3 轮 0 条；
 * - P3 空哨兵（`valuesEqual` 口径）：`'' ↔ null` ⇒ 0 条（变异 ② 的 kill 靶）；
 * - P4 本机编辑 3 字段 ⇒ 恰 1 条（变异 ① 摘接线的 kill 靶）；
 * - P5 审计写失败 ⇒ 业务照常落库 + `audit.record.failed`（变异 ⑤ 前置抛错的 kill 靶）；
 * - P6 有界：1000 + 1 ⇒ 裁到 1000（变异 ⑥ 去淘汰的 kill 靶）；
 * - P7 `hasMore` 边界：恰好 5 条 ⇒ `hasMore:false`（独立发现：`>` 改 `>=` 的变异只能被本例杀掉）。
 *
 * 本文件**只读取生产行为**，不含任何 mock 掉被测逻辑的桩（假服务端仅模拟服务端契约）。
 */

const USER_ID = 't706-qa-probe-user'
const SECRET_NAME = 'QA-PROBE-SECRET-任务名-3f9c'

const resetState = async (): Promise<void> => {
    for (const table of [
        'projects',
        'projectPreferences',
        'tags',
        'tagPreferences',
        'tasks',
        'taskCheckItems',
        'taskComments',
        'pomodoros',
        'pomodoroRecords',
        'users',
        'userConfigs',
        'meta',
        'deletionSchedules',
        'syncQueue',
        'syncCursor'
    ] as const) {
        await localDatabase.table(table).clear()
    }
    if (localDatabase.tables.some((table) => table.name === 'auditLogs')) {
        await localDatabase.table('auditLogs').clear()
    }
    localStorage.clear()
    localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-t706-probe')
    cryptoService.lock()
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'probe-password')
    syncStatus.setConflictCount(0)
    clearStructuredLog()
}

const auditRows = async (): Promise<Record<string, unknown>[]> => {
    if (!localDatabase.tables.some((table) => table.name === 'auditLogs')) return []
    return (await localDatabase.table('auditLogs').toArray()) as Record<string, unknown>[]
}

// --- 最小假服务端（只模拟服务端契约：keyset / OCC / 收集箱隐式桶） ---------------
interface FakeServer {
    requester: Requester
    rows: Map<string, Record<string, unknown>>
    replay: boolean
    setRow: (id: string, patch: Record<string, unknown>, at?: string) => string
    row: (id: string) => Record<string, unknown> | undefined
}

const EMPTY = { items: [], total: 0, nextCursor: '', nextCursorId: '' }
const BASE = '2026-02-01T00:00:00.000Z'

const makeServer = (): FakeServer => {
    const rows = new Map<string, Record<string, unknown>>()
    let seq = 0
    const tick = () => new Date(Date.parse(BASE) + 60_000 + (seq += 1) * 1000).toISOString()
    const server: FakeServer = {
        requester: null as unknown as Requester,
        rows,
        replay: false,
        setRow: (id, patch, at) => {
            const next = { ...rows.get(id), ...patch, updatedAt: at ?? tick() }
            rows.set(id, next)
            return String(next.updatedAt)
        },
        row: (id) => rows.get(id)
    }
    const pull = (body: Record<string, { updatedAt?: string } | undefined>) => {
        const cursor = body.tasks?.updatedAt ?? ''
        const cursorTs = Date.parse(cursor) || 0
        const items = [...rows.values()].filter(
            (row) => server.replay || (Date.parse(String(row.updatedAt)) || 0) > cursorTs
        )
        return {
            data: {
                data: {
                    tasks: { items, total: items.length, nextCursor: '', nextCursorId: '' },
                    projects: EMPTY,
                    tags: EMPTY,
                    taskCheckItems: EMPTY,
                    taskComments: EMPTY,
                    pomodoros: EMPTY,
                    pomodoroRecords: EMPTY
                },
                serverTime: Date.now()
            }
        }
    }
    const push = (body: { tasks?: Record<string, unknown>[] }) => {
        const results = (body.tasks ?? []).map((item) => {
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
            const merged = {
                ...current,
                ...payload,
                // 服务端隐式桶：空项目归一到 userId（读侧归一的对照面）
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
        data:
            url === '/sync/pull'
                ? pull((body ?? {}) as never)
                : url === '/sync/push'
                  ? push((body ?? {}) as never)
                  : {}
    }))
    server.requester = {
        post,
        get: vi.fn(async () => ({ data: {} })),
        put: vi.fn(async () => ({ data: {} })),
        delete: vi.fn(async () => ({ data: {} }))
    } as unknown as Requester
    return server
}

const createTask = async (overrides: Partial<CreateTaskValueObject> = {}): Promise<string> => {
    const vo = new CreateTaskValueObject(
        null,
        null,
        overrides.name ?? 'QA 探针任务',
        overrides.description ?? 'QA 探针描述',
        'todo',
        'medium',
        null,
        null,
        overrides.projectId ?? 'project-qa',
        [],
        null,
        'none',
        null,
        []
    )
    const [task, err] = await newLocalTaskRepository().create(vo)
    expect(err).toBeNull()
    return task!.id
}

/** 建「已同步任务」+ 清掉 `create` 那条审计（只量被测行为） */
const syncedTask = async (
    server: FakeServer,
    overrides: Partial<CreateTaskValueObject> = {}
): Promise<string> => {
    const id = await createTask(overrides)
    await new SyncService(server.requester).pushAll()
    await clearAudit(USER_ID)
    return id
}

const patch = async (id: string, changes: Record<string, unknown>): Promise<void> => {
    const vo = new UpdateTaskValueObject(id)
    for (const [field, value] of Object.entries(changes)) {
        ;(vo as unknown as Record<string, unknown>)[field] = value
    }
    expect(await newLocalTaskRepository().update(id, vo)).toBeNull()
}

describe('T706 探针 ①：DEF-147 相同记录回拉 3 轮 ⇒ 每轮仍 put 但审计 0 条', () => {
    beforeEach(resetState)

    it('内容未变连续 pull 3 轮：put ≥1/轮，audit 恒 0（判据不是「调用了一次 put」）', async () => {
        const server = makeServer()
        const id = await syncedTask(server)
        server.replay = true
        const putSpy = vi.spyOn(localDatabase.tasks, 'put')

        for (let round = 1; round <= 3; round += 1) {
            putSpy.mockClear()
            await new SyncService(server.requester).pullAll()
            expect(
                putSpy.mock.calls.length,
                `第 ${round} 轮应仍发生 tasks.put（DEF-147 现状）`
            ).toBeGreaterThanOrEqual(1)
            expect(await auditRows(), `第 ${round} 轮内容未变不得产审计`).toHaveLength(0)
        }
        putSpy.mockRestore()
        expect(await localDatabase.tasks.get(id)).toBeTruthy()
    })
})

describe('T706 探针 ②：DEF-159 收集箱桶归一 ⇒ 3 轮 0 条（变异「删归一」必须红）', () => {
    beforeEach(resetState)

    it('本地 inbox ↔ 服务端 userId：3 轮 0 条，且本地仍是字面 inbox', async () => {
        const server = makeServer()
        const id = await syncedTask(server, { projectId: 'inbox' })
        expect(String(server.row(id)?.projectId), '夹具自检：服务端必须以 userId 承载收集箱').toBe(
            USER_ID
        )
        expect(String((await localDatabase.tasks.get(id))?.projectId)).toBe('inbox')
        server.replay = true

        for (let round = 1; round <= 3; round += 1) {
            await new SyncService(server.requester).pullAll()
            expect(await auditRows(), `第 ${round} 轮：桶映射不是业务变更`).toHaveLength(0)
            expect(String((await localDatabase.tasks.get(id))?.projectId)).toBe('inbox')
        }
    })

    it('收集箱 + 每轮只推进服务端 updatedAt（记录层预筛挡不住）⇒ 仍 0 条（实体层归一必须存在）', async () => {
        const server = makeServer()
        const id = await syncedTask(server, { projectId: 'inbox' })
        server.replay = true

        for (let round = 1; round <= 3; round += 1) {
            server.setRow(id, {}) // 只推进 updatedAt，业务字段原样
            await new SyncService(server.requester).pullAll()
            expect(
                await auditRows(),
                `第 ${round} 轮：记录层不同但业务等价（桶映射）⇒ 不得产审计`
            ).toHaveLength(0)
        }
    })
})

describe('T706 永久护栏 A（T708 固化）：收集箱 + 真实变更 ⇒ `fields` 恰 [description]（删实体层归一 ⇒ 必红）', () => {
    beforeEach(resetState)

    it('收集箱任务远端只改 description ⇒ fields 恰为 [description]（不产假 projectId 变更）', async () => {
        const server = makeServer()
        const id = await syncedTask(server, { projectId: 'inbox' })
        // 记录层预筛会通过（description 真变）⇒ 实体层若不归一，`inbox` vs `userId` 会多记一条 projectId
        server.setRow(id, { description: 'QA 收集箱远端改描述' })

        await new SyncService(server.requester).pullAll()

        const rows = await auditRows()
        expect(rows).toHaveLength(1)
        expect(
            (rows[0]!.fields as Array<{ field: string }>).map((item) => item.field),
            '收集箱桶归一缺失时这里会是 [projectId, description]'
        ).toEqual(['description'])
    })
})

describe('T706 永久护栏 B（T708 固化）：记录层预筛存在性 —— 解密次数 = 0（删预筛 ⇒ 本例红）', () => {
    beforeEach(resetState)

    it('未变化行重放 1 轮：审计 0 条 **且** 不解密（预筛把「相同记录」挡在解密之外）', async () => {
        const server = makeServer()
        await syncedTask(server)
        server.replay = true
        const decrypt = vi.spyOn(cryptoService, 'decrypt')

        await new SyncService(server.requester).pullAll()

        expect(await auditRows()).toHaveLength(0)
        // 记录层预筛若被删掉，实体层精筛仍会算出 0 条差异（行为等价）⇒ 只能靠解密次数抓
        expect(
            decrypt.mock.calls.length,
            '未变化行不得进入实体层（预筛应零解密；删预筛 ⇒ 本条红）'
        ).toBe(0)
        decrypt.mockRestore()
    })
})

describe('T706 探针 ③：空哨兵等价（变异「!== 替 valuesEqual」必须红）', () => {
    beforeEach(resetState)

    it("真实变更 + 空哨兵并存（description 真变、startAt 由 '' 变 null）⇒ fields 恰含 description", async () => {
        const server = makeServer()
        const id = await syncedTask(server)
        // ⚠️ 必须带一个**真实变更**：否则记录层预筛（同样用 valuesEqual）会先挡掉，测不到实体层判等
        server.setRow(id, { description: 'QA 远端改描述', startAt: null })

        await new SyncService(server.requester).pullAll()

        const rows = await auditRows()
        expect(rows).toHaveLength(1)
        expect(
            (rows[0]!.fields as Array<{ field: string }>).map((item) => item.field),
            "空哨兵 '' ↔ null 不是变更（`!==` 实现会多记 startAt）"
        ).toEqual(['description'])
    })
})

describe('T706 探针 ④：本机编辑 3 字段 ⇒ 恰 1 条（变异「摘接线」必须红）', () => {
    beforeEach(resetState)

    it('update 改 name/description/priority ⇒ 1 条 local-edit/update，fields 恰 3 个', async () => {
        const id = await createTask()
        await clearAudit(USER_ID)

        await patch(id, { name: 'QA 改名', description: 'QA 改描述', priority: 'high' })

        const rows = await auditRows()
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ entityId: id, source: 'local-edit', action: 'update' })
        expect((rows[0]!.fields as Array<{ field: string }>).map((item) => item.field)).toEqual([
            'name',
            'description',
            'priority'
        ])
    })
})

describe('T706 探针 ⑤：审计写失败不阻断业务（变异「前置抛错」必须红）', () => {
    beforeEach(resetState)

    it('auditLogs.add 抛错 ⇒ 保存成功 + 行已落库 + audit.record.failed（不含业务值）', async () => {
        const id = await createTask({ name: SECRET_NAME })
        await clearAudit(USER_ID)
        const prototype = Object.getPrototypeOf(localDatabase.tasks) as {
            add: (...args: unknown[]) => Promise<unknown>
        }
        const original = prototype.add
        const spy = vi.spyOn(prototype, 'add').mockImplementation(function (
            this: { name: string },
            ...args: unknown[]
        ) {
            if (this.name === 'auditLogs') return Promise.reject(new Error('QuotaExceededError'))
            return original.apply(this, args)
        } as never)

        try {
            await patch(id, { name: 'QA 失败后仍保存' })
            expect(await localDatabase.tasks.get(id)).toBeTruthy()
            expect((await auditRows()).length && 0).toBe(0)
            const events = readStructuredLog().filter(
                (entry) => String(entry.event) === 'audit.record.failed'
            )
            expect(events, '必须留 audit.record.failed').toHaveLength(1)
            expect(events[0]!.level).toBe('error')
            const serialized = JSON.stringify(readStructuredLog())
            expect(serialized).not.toContain(SECRET_NAME)
            expect(serialized).not.toContain('QA 失败后仍保存')
        } finally {
            spy.mockRestore()
        }
    })
})

describe('T706 探针 ⑥：有界（变异「去淘汰」必须红）', () => {
    beforeEach(resetState)

    it('1000 条 + 1 次真实写 ⇒ 裁到 1000 且最旧被淘汰', async () => {
        const id = await createTask()
        await clearAudit(USER_ID)
        const table = localDatabase.table('auditLogs')
        const now = Date.now()
        await table.bulkAdd(
            Array.from({ length: 1000 }, (_, index) => ({
                userId: USER_ID,
                entity: 'tasks',
                entityId: `seeded-${index}`,
                action: 'update',
                source: 'local-edit',
                fields: [],
                at: new Date(now - 10 * 24 * 3600 * 1000 + index * 1000).toISOString()
            })) as never[]
        )

        await patch(id, { name: 'QA 触发裁切' })

        await vi.waitFor(
            async () => {
                expect((await auditRows()).length, '超过 1000 条必须裁到上限').toBe(1000)
            },
            { timeout: 5000, interval: 50 }
        )
        const ids = (await auditRows()).map((row) => String(row.entityId))
        expect(ids).not.toContain('seeded-0')
        expect(ids).toContain(id)
    })
})

describe('T706 永久护栏 C（T708 固化）：`hasMore` 恰好一页（5 条）⇒ false（`>`→`>=` 变异 ⇒ 必红）', () => {
    beforeEach(resetState)

    it('恰好 5 条（= 默认页大小）⇒ 首页 5 条且 hasMore=false', async () => {
        for (let index = 1; index <= 5; index += 1) {
            expect(
                await recordAudit({
                    entityId: 'qa-exact-page',
                    action: 'update',
                    source: 'local-edit',
                    fields: []
                })
            ).toBeTypeOf('number')
        }

        const page = await loadAudit('qa-exact-page', undefined, 5)

        expect(page.items).toHaveLength(5)
        expect(page.hasMore, '恰好一页时不得声称「还有更早」（`>` 改 `>=` 会被本例杀掉）').toBe(
            false
        )
        expect(page.unavailable).toBe(false)
    })
})