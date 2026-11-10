// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { CreateTaskValueObject, UpdateTaskValueObject } from '@nao-todo/domain-task'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { messages } from '@nao-todo/shared/locales'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import {
    compareConflict,
    loadConflictJournal,
    resolveConflictKeepServer,
    resolveConflictRetryLocal,
    type ConflictJournalEntry
} from '../conflict-journal'
import { syncStatus } from '../sync-status'
import { SyncService } from '../sync-service'

/**
 * T671 · QA 独立复现（DEF-146 后续 / 用户走查 ② 失败）—— **不同字段为何仍出现冲突记录**
 *
 * 目的（⛔ 先取证后结论）：用**真实数据层链路**（本地仓储 + `SyncService.pullAll/pushAll`）
 * 复现三种时序，打印 journal 的 kind / loser / serverCurrent / 字段名，并隔离「保存侧记账」这一步：
 *
 * - 时序 X：B 编辑前**已拉取** A 的修改（base 已前进）⇒ 预期保存侧与同步均 **0 条**；
 * - 时序 Y：B 保存后**先 push**（未拉取）⇒ 既有**行级 OCC** `stale`（服务端 base 不匹配）；
 * - 时序 Z：B 保存后**先 pull**（周期自动刷新）⇒ 既有 A1 `pull-local-wins`（本地队列 + 远端到达）。
 *
 * 关键隔离断言：**B 保存完成、尚未 pull/push 时 journal 恒为 0** ⇒ 记录不是保存侧三值判定产生的。
 *
 * 假服务端只模拟 OCC/幂等语义（base 比较、applied/stale 回执、serverCurrent、pull keyset），
 * 不参与产品判定；所有断言读取真实 `conflict-journal` 与本地行。
 */

const USER_ID = 't671-qa-user'
const BASE_TIME = '2026-02-01T00:00:00.000Z'
const EMPTY_TABLE = { items: [], total: 0, nextCursor: '', nextCursorId: '' }

type RawRecord = Record<string, unknown>

interface FakeServer {
    requester: Requester
    state: Map<string, RawRecord>
    snapshots: RawRecord[]
    setRemote: (id: string, patch: RawRecord) => string
    row: (id: string) => RawRecord | undefined
}

/** 最小假服务端：只做 base 比较 + applied/stale + pull keyset（字段与真实后端契约同形） */
const makeServer = (): FakeServer => {
    const state = new Map<string, RawRecord>()
    const snapshots: RawRecord[] = []
    let seq = 0
    const tick = (): string =>
        new Date(Date.parse(BASE_TIME) + 60_000 + (seq += 1) * 1000).toISOString()

    const postInner = async (url: string, body: unknown): Promise<unknown> => {
        if (url === '/sync/pull') {
            const cursor = (body as { tasks?: { updatedAt?: string } }).tasks?.updatedAt ?? ''
            const cursorTs = Date.parse(cursor) || 0
            const items = [...state.values()].filter(
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
                    }
                },
                serverTime: Date.now()
            }
        }
        if (url === '/sync/push') {
            const tasks = (body as { tasks?: RawRecord[] }).tasks ?? []
            const results = tasks.map((item) => {
                const current = state.get(String(item.id))
                return current && item.baseUpdatedAt && item.baseUpdatedAt !== current.updatedAt
                    ? {
                          table: 'tasks',
                          id: String(item.id),
                          outcome: 'stale',
                          serverUpdatedAt: current.updatedAt,
                          serverCurrent: current
                      }
                    : (() => {
                          const { baseUpdatedAt: _base, ...payload } = item
                          const merged: RawRecord = {
                              ...current,
                              ...payload,
                              updatedAt: tick()
                          }
                          state.set(String(item.id), merged)
                          return {
                              table: 'tasks',
                              id: String(item.id),
                              outcome: 'applied',
                              serverUpdatedAt: merged.updatedAt,
                              serverCurrent: merged
                          }
                      })()
            })
            return { data: { results }, serverTime: Date.now() }
        }
        return { data: {} }
    }
    const post = vi.fn(async (url: string, body: unknown) => ({
        data: await postInner(url, body)
    }))

    return {
        requester: {
            post,
            get: vi.fn(async () => ({ data: {} })),
            put: vi.fn(async () => ({ data: {} })),
            delete: vi.fn(async () => ({ data: {} }))
        } as unknown as Requester,
        state,
        snapshots,
        setRemote: (id, patch) => {
            const current = state.get(id)
            const next: RawRecord = { ...current, ...patch, updatedAt: tick() }
            state.set(id, next)
            return String(next.updatedAt)
        },
        row: (id) => state.get(id)
    }
}

const resetLocalState = async (): Promise<void> => {
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
    cryptoService.lock()
    localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-t671-fixture')
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
    syncStatus.setConflictCount(0)
}

const makeTask = async (name: string, description: string): Promise<string> => {
    const repo = newLocalTaskRepository()
    const [task, err] = await repo.create(
        new CreateTaskValueObject(
            null,
            null,
            name,
            description,
            'todo',
            'medium',
            null,
            null,
            'project-1',
            [],
            null,
            'none',
            null,
            []
        )
    )
    expect(err).toBeNull()
    return (task as { id: string }).id
}

const saveName = async (id: string, name: string, originName?: string): Promise<void> => {
    const vo = new UpdateTaskValueObject(id)
    vo.name = name
    const err = await newLocalTaskRepository().update(
        id,
        vo,
        originName === undefined ? undefined : { name: originName }
    )
    expect(err).toBeNull()
}

const saveNameAndDescription = async (
    id: string,
    name: string,
    description: string,
    origin: { name: string; description: string }
): Promise<void> => {
    const vo = new UpdateTaskValueObject(id)
    vo.name = name
    vo.description = description
    const err = await newLocalTaskRepository().update(id, vo, origin)
    expect(err).toBeNull()
}

const journal = (): Promise<ConflictJournalEntry[]> => loadConflictJournal(USER_ID)

const localTask = async (id: string): Promise<RawRecord> => {
    const record = (await localDatabase.tasks.get(id)) as unknown as RawRecord
    return {
        name: await cryptoService.decrypt(record.name as string),
        description: await cryptoService.decrypt(record.description as string),
        updatedAt: record.updatedAt,
        syncedServerUpdatedAt: record.syncedServerUpdatedAt
    }
}

const dump = (label: string, value: unknown): void => {
    // 证据留痕：报告里的 kind / loser / serverCurrent 直接来自本行输出
    console.log(`[T671] ${label} ${JSON.stringify(value)}`)
}

/** 初始：本地建任务 → 首次 push 到假服务端（本地 base = T1） */
const initSynced = async (
    server: FakeServer,
    name = 'A0-name',
    description = 'A0-desc'
): Promise<string> => {
    const id = await makeTask(name, description)
    await new SyncService(server.requester).pushAll()
    expect(await journal()).toHaveLength(0)
    return id
}

describe('T671 时序 X：B 编辑前已拉取（base 已前进）⇒ 不同字段 0 条', () => {
    beforeEach(resetLocalState)

    it('X1 A 改描述 → B 拉取 → B 保存名称（只带 name）⇒ 保存 0 条、push applied、无记录', async () => {
        const server = makeServer()
        const id = await initSynced(server)
        server.setRemote(id, { description: 'A-desc' })
        await new SyncService(server.requester).pullAll()
        expect((await localTask(id)).description).toBe('A-desc')

        await saveName(id, 'B-name', 'A0-name')
        // 关键隔离：保存侧三值判定不产生记录
        expect(await journal()).toHaveLength(0)

        await new SyncService(server.requester).pushAll()
        expect(await journal()).toHaveLength(0)
        dump('X1 local', await localTask(id))
        dump('X1 server', server.row(id))
        expect((await localTask(id)).name).toBe('B-name')
        expect((await localTask(id)).description).toBe('A-desc')
        expect(server.row(id)?.description).toBe('A-desc')
    })

    it('X2 即使载荷同时带 name+description（编辑器整表单提交）⇒ 仍 0 条', async () => {
        const server = makeServer()
        const id = await initSynced(server)
        server.setRemote(id, { description: 'A-desc' })
        await new SyncService(server.requester).pullAll()

        // 拉取后未编辑字段的编辑基准随 store 前进（= A-desc）
        await saveNameAndDescription(id, 'B-name', 'A-desc', {
            name: 'A0-name',
            description: 'A-desc'
        })
        expect(await journal()).toHaveLength(0)

        await new SyncService(server.requester).pushAll()
        expect(await journal()).toHaveLength(0)
    })
})

describe('T671 时序 Y：B 保存后先 push（未拉取）⇒ 既有行级 OCC `stale`', () => {
    beforeEach(resetLocalState)

    it('Y1 记录 kind=stale；loser=我的整行、serverCurrent=云端整行、字段级内容可见', async () => {
        const server = makeServer()
        const id = await initSynced(server)
        const remoteAt = server.setRemote(id, { description: 'A-desc' })

        await saveName(id, 'B-name', 'A0-name')
        expect(await journal()).toHaveLength(0) // 保存侧：0 条

        await new SyncService(server.requester).pushAll()

        const entries = await journal()
        expect(entries).toHaveLength(1)
        const entry = entries[0]!
        dump('Y1 entry', {
            kind: entry.kind,
            table: entry.table,
            entityId: entry.entityId,
            loser: entry.loser,
            loserUpdatedAt: entry.loserUpdatedAt,
            winnerUpdatedAt: entry.winnerUpdatedAt,
            serverCurrent: entry.serverCurrent,
            loserFields: Object.keys(entry.loser).sort()
        })
        expect(entry.kind).toBe('stale')
        expect(entry.table).toBe('tasks')
        expect(entry.entityId).toBe(id)
        expect(entry.loser).toMatchObject({ name: 'B-name', description: 'A0-desc' })
        expect(entry.serverCurrent).toMatchObject({ name: 'A0-name', description: 'A-desc' })
        expect(entry.winnerUpdatedAt).toBe(remoteAt)
        // 既有行级 OCC：远端版本不是本批保存侧判据产生的（保存侧见上 = 0）
        expect(entry.loserUpdatedAt).toBeDefined()
    })

    it('Y0 对照组：不传编辑基准（= 回退本批保存侧改动的等价路径）⇒ 同场景仍 stale', async () => {
        const server = makeServer()
        const id = await initSynced(server)
        server.setRemote(id, { description: 'A-desc' })

        // R-6：不传 = 本批之前的保存行为逐字一致（保存侧无任何判定）
        await saveName(id, 'B-name')
        expect(await journal()).toHaveLength(0)

        await new SyncService(server.requester).pushAll()
        const entries = await journal()
        dump('Y0 entry', { kind: entries[0]?.kind, loser: entries[0]?.loser })
        expect(entries).toHaveLength(1)
        expect(entries[0]!.kind).toBe('stale')
        expect(entries[0]!.loser).toMatchObject({ name: 'B-name', description: 'A0-desc' })
    })

    it('Y2 动作只会整行二选一：保留我的 ⇒ 云端描述丢失；用云端的 ⇒ 我的名称丢失', async () => {
        // 分支 a：保留我的修改
        let server = makeServer()
        let id = await initSynced(server)
        server.setRemote(id, { description: 'A-desc' })
        await saveName(id, 'B-name', 'A0-name')
        await new SyncService(server.requester).pushAll()
        const retry = await resolveConflictRetryLocal(USER_ID, 'tasks', id)
        dump('Y2 retry', { result: retry, local: await localTask(id) })
        expect(retry.ok).toBe(true)
        expect(await localTask(id)).toMatchObject({ name: 'B-name', description: 'A0-desc' })
        await new SyncService(server.requester).pushAll()
        // ⚠️ A 的描述被这次保存覆盖（行级整行）
        expect(server.row(id)?.description).toBe('A0-desc')

        // 分支 b：用云端的
        await resetLocalState()
        server = makeServer()
        id = await initSynced(server)
        server.setRemote(id, { description: 'A-desc' })
        await saveName(id, 'B-name', 'A0-name')
        await new SyncService(server.requester).pushAll()
        const keep = await resolveConflictKeepServer(USER_ID, 'tasks', id)
        dump('Y2 keep', { result: keep, local: await localTask(id) })
        expect(keep.ok).toBe(true)
        expect(await localTask(id)).toMatchObject({ name: 'A0-name', description: 'A-desc' })
    })

    it('Y3 stale 后若先发生一次 pull（自动刷新）⇒ 面板对比才出现双侧字段差异', async () => {
        const server = makeServer()
        const id = await initSynced(server)
        server.setRemote(id, { description: 'A-desc' })
        await saveName(id, 'B-name', 'A0-name')
        await new SyncService(server.requester).pushAll()

        const before = await compareConflict(USER_ID, 'tasks', id)
        dump('Y3 compare-before-pull', before)
        await new SyncService(server.requester).pullAll()
        const after = await compareConflict(USER_ID, 'tasks', id)
        dump('Y3 compare-after-pull', after)
        const fields = after?.diffs.map((diff) => diff.field) ?? []
        // 既有 stale 快照含 `updatedAt`（技术字段，次要样式），业务字段必须出现 name + description
        expect(fields).toEqual(expect.arrayContaining(['description', 'name']))
        dump('Y3 diff-fields', fields)
    })
})

describe('T671 时序 Z：B 保存后先 pull（周期自动刷新）⇒ 既有 A1 `pull-local-wins`', () => {
    beforeEach(resetLocalState)

    it('Z0 对照组：不传编辑基准（= 回退本批保存侧改动的等价路径）⇒ 同场景仍 pull-local-wins', async () => {
        const server = makeServer()
        const id = await initSynced(server)
        server.setRemote(id, { description: 'A-desc' })

        await saveName(id, 'B-name') // 不传 origin
        expect(await journal()).toHaveLength(0)

        await new SyncService(server.requester).pullAll()
        const entries = await journal()
        dump('Z0 entry', {
            kind: entries[0]?.kind,
            loser: entries[0]?.loser,
            loserUpdatedAt: entries[0]?.loserUpdatedAt
        })
        expect(entries).toHaveLength(1)
        expect(entries[0]!.kind).toBe('pull-local-wins')
        expect(entries[0]!.loserUpdatedAt).toBeDefined()
    })

    it('Z1 记录 kind=pull-local-wins、loser=云端整行、loserUpdatedAt 有值（非保存侧）', async () => {
        const server = makeServer()
        const id = await initSynced(server)
        const remoteAt = server.setRemote(id, { description: 'A-desc' })

        await saveName(id, 'B-name', 'A0-name')
        expect(await journal()).toHaveLength(0) // 保存侧：0 条

        await new SyncService(server.requester).pullAll() // 周期 auto-refresh：只 pull

        const entries = await journal()
        expect(entries).toHaveLength(1)
        const entry = entries[0]!
        dump('Z1 entry', {
            kind: entry.kind,
            table: entry.table,
            entityId: entry.entityId,
            loser: entry.loser,
            loserUpdatedAt: entry.loserUpdatedAt,
            winnerUpdatedAt: entry.winnerUpdatedAt,
            loserFields: Object.keys(entry.loser).sort()
        })
        expect(entry.kind).toBe('pull-local-wins')
        expect(entry.loser).toMatchObject({ name: 'A0-name', description: 'A-desc' })
        // A1 标志：败方=远端快照（loserUpdatedAt = 远端 updatedAt）；保存侧记录不会带该字段
        expect(entry.loserUpdatedAt).toBe(remoteAt)

        // 随后的 push 会把「我的整行」写回服务端 ⇒ 云端描述被覆盖（真实覆盖，记录是诚实的）
        await new SyncService(server.requester).pushAll()
        dump('Z1 after-push server', server.row(id))
        expect(server.row(id)?.name).toBe('B-name')
        expect(server.row(id)?.description).toBe('A0-desc')
    })
})

describe('T671 面板措辞（是否让用户以为可合并）', () => {
    it('W1 安全提示/按钮均为「整条版本」措辞，无「合并」承诺', () => {
        const zh = messages['zh-CN']
        dump('W1 wording', {
            safetyHint: zh['sync.conflict.safetyHint'],
            loserLabel: zh['sync.conflict.loserLabel'],
            currentLabel: zh['sync.conflict.currentLabel'],
            keepServer: zh['sync.conflict.keepServer'],
            retryLocal: zh['sync.conflict.retryLocal'],
            staleKind: zh['sync.conflict.kind.stale']
        })
        expect(zh['sync.conflict.safetyHint']).toContain('版本')
        expect(zh['sync.conflict.safetyHint']).not.toContain('合并')
        expect(zh['sync.conflict.safetyHint']).not.toContain('逐字段')
    })
})