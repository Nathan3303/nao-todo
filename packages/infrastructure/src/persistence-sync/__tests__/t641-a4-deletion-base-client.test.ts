// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { loadConflictJournal } from '../conflict-journal'
import { syncStatus } from '../sync-status'
import { syncTracker } from '../sync-tracker'
import { SyncService } from '../sync-service'

/**
 * T641 / `A4`（`F-04`）**客户端侧**用例先行（红基线）—— 删除也要裁决
 *
 * 契约真源：`T640` **Q4**（`SyncDeletion` 增 `baseUpdatedAt,omitempty`；缺省 ⇒ 逐字现状；
 *          行物理缺失 ⇒ 不带 base；新客户端 + 老服务端 ⇒ **不得据「没收到 stale」认定已裁决**，
 *          以回执是否有 `outcome` 做能力探测）· PRD AC4 / `R-D`（老客户端行为逐字不变 · 红线）。
 *
 * 本文件**只覆盖客户端侧**（服务端 Go 用例属 `T642` rd-be）。
 *
 * 覆盖：
 * ① 删除载荷逐条携带 `baseUpdatedAt`（取该行 `syncedServerUpdatedAt`）—— 现状**红**；
 * ② 行已物理缺失 ⇒ **不带** base（回退「删除优先」）—— 现绿护栏；
 * ③ 回执 `stale`（删除被拒）⇒ **落账（loser 非空，含本地内容）+ 本地行保留（不复活）
 *    + 出队 + base 写回** —— `loser` 现状**红**（delete action 无快照）；
 * ④ 旧载荷（本地无 base ⇒ `deletions` 不带 base）**行为逐字不变** —— 现绿护栏（`R-D` 红线）；
 * ⑤ 能力探测：回执无 `outcome` ⇒ **不得**认定已裁决 —— 现状**红**（无能力信号）。
 *
 * ⚠️ 形状说明（**待实现确认**）：能力探测期望 `syncStatus.get().deletionOCCSupported: boolean`
 *    （回执出现 `outcome` ⇒ true；缺失 ⇒ false）。
 */

const USER_ID = 't641-a4-user'
const BASE = '2029-01-01T00:00:00.000Z'
const SERVER_NEWER = '2029-06-01T00:00:00.000Z'

type RawRecord = Record<string, unknown>

const EMPTY_TABLE = { items: [], total: 0, nextCursor: '', nextCursorId: '' }
const EMPTY_PULL_DATA = {
    tasks: EMPTY_TABLE,
    projects: EMPTY_TABLE,
    tags: EMPTY_TABLE,
    taskCheckItems: EMPTY_TABLE,
    taskComments: EMPTY_TABLE,
    pomodoros: EMPTY_TABLE,
    pomodoroRecords: EMPTY_TABLE
}

const makeRequester = (
    handler: (url: string, body: unknown) => unknown
): { requester: Requester; post: ReturnType<typeof vi.fn> } => {
    const post = vi.fn(async (url: string, body: unknown) => ({ data: handler(url, body) }))
    const requester = {
        post,
        get: vi.fn(async () => ({ data: {} })),
        put: vi.fn(async () => ({ data: {} })),
        delete: vi.fn(async () => ({ data: {} }))
    } as unknown as Requester
    return { requester, post }
}

const pullEnvelope = () => ({
    code: 90020,
    message: 'ok',
    data: { data: EMPTY_PULL_DATA, serverTime: String(Date.now()) }
})

const pushEnvelope = (results: unknown[]) => ({
    code: 90010,
    message: 'ok',
    data: { results, serverTime: String(Date.now()) }
})

const taskVO = (name: string): CreateTaskValueObject =>
    new CreateTaskValueObject(
        null,
        null,
        name,
        '',
        'todo',
        'medium',
        null,
        null,
        'p-1',
        [],
        null,
        'none',
        null,
        []
    )

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
    localStorage.clear()
    cryptoService.lock()
    localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-t641-a4')
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
    syncStatus.setConflictCount(0)
}

const makeTask = async (name: string): Promise<string> => {
    const repo = newLocalTaskRepository()
    const [task, err] = await repo.create(taskVO(name))
    expect(err).toBeNull()
    return (task as { id: string }).id
}

const rawTaskOf = async (id: string): Promise<RawRecord | undefined> =>
    (await localDatabase.tasks.get(id)) as unknown as RawRecord | undefined

const baseOf = async (id: string): Promise<unknown> => (await rawTaskOf(id))?.syncedServerUpdatedAt

const seedBase = async (id: string, value: string): Promise<void> => {
    await localDatabase.tasks.update(id, { syncedServerUpdatedAt: value })
}

/** 取 push 请求体 */
const pushBodyOf = (post: ReturnType<typeof vi.fn>): RawRecord =>
    post.mock.calls[0]?.[1] as RawRecord

/** 能力探测信号（期望形状；**形状待实现确认**） */
const deletionOCCSupported = (): unknown =>
    (syncStatus.get() as unknown as Record<string, unknown>).deletionOCCSupported

describe('T641 / A4 删除载荷携带 base', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('AC4/F-R 有 base 的行 ⇒ deletions 逐条带 baseUpdatedAt（= syncedServerUpdatedAt）', async () => {
        const id = await makeTask('待删除任务')
        await seedBase(id, BASE)
        expect(await newLocalTaskRepository().remove(id)).toBeNull()

        const { requester, post } = makeRequester((url) =>
            url === '/sync/push'
                ? pushEnvelope([{ table: 'tasks', id, outcome: 'applied' }])
                : pullEnvelope()
        )
        await new SyncService(requester).pushAll()

        const body = pushBodyOf(post)
        // 现状红：`{ table, id }`（无 base ⇒ 服务端「删除永远赢」）
        expect(body.deletions).toEqual([{ table: 'tasks', id, baseUpdatedAt: BASE }])
    })

    it('AC4 行已物理缺失 ⇒ 不带 base（回退删除优先）—— 现绿护栏', async () => {
        const id = await makeTask('行已缺失')
        await seedBase(id, BASE)
        // 模拟本地记录被物理清理但队列仍保留 delete
        await localDatabase.tasks.delete(id)
        const key = `${USER_ID}:tasks:${id}`
        const queued = await localDatabase.syncQueue.get(key)
        await localDatabase.syncQueue.put({ ...queued!, action: 'delete' })

        const { requester, post } = makeRequester((url) =>
            url === '/sync/push'
                ? pushEnvelope([{ table: 'tasks', id, outcome: 'applied' }])
                : pullEnvelope()
        )
        await new SyncService(requester).pushAll()

        const deletions = pushBodyOf(post).deletions as RawRecord[]
        expect(deletions).toEqual([{ table: 'tasks', id }])
        expect('baseUpdatedAt' in deletions[0]!).toBe(false)
    })
})

describe('T641 / A4 删除回执消费', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('AC4 回执 stale（删除被拒）⇒ 落账含本地内容 + 本地行保留（不复活）+ 出队 + base 写回', async () => {
        const id = await makeTask('离线删除的任务')
        await seedBase(id, BASE)
        expect(await newLocalTaskRepository().remove(id)).toBeNull()

        const { requester } = makeRequester((url) =>
            url === '/sync/push'
                ? pushEnvelope([
                      { table: 'tasks', id, outcome: 'stale', serverUpdatedAt: SERVER_NEWER }
                  ])
                : pullEnvelope()
        )
        await new SyncService(requester).pushAll()

        const entries = await loadConflictJournal(USER_ID)
        expect(entries).toHaveLength(1)
        const entry = entries[0]!
        expect(String(entry.kind)).toBe('stale')
        expect(entry.entityId).toBe(id)
        // 现状红：delete action 的 loser 恒 `{}`（用户看不到自己删的是什么）
        const loser = entry.loser as RawRecord
        expect(Object.keys(loser).length).toBeGreaterThan(0)
        expect(loser.name).toBe('离线删除的任务')
        // 本地行保留（回执处理不得把墓碑清成活动行；「编辑赢」由后续 pull 落定）
        expect(await rawTaskOf(id)).toBeTruthy()
        expect((await rawTaskOf(id))?.deletedAt).not.toBeNull()
        // base 写回库中版本（防 R-20 永久 stale）
        expect(await baseOf(id)).toBe(SERVER_NEWER)
        // 出队
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)
    })

    it('AC4 旧载荷（本地无 base ⇒ 不带 base）行为逐字不变 —— 现绿护栏（R-D 红线）', async () => {
        const id = await makeTask('无 base 删除')
        expect(await newLocalTaskRepository().remove(id)).toBeNull()

        const { requester, post } = makeRequester((url) =>
            url === '/sync/push'
                ? pushEnvelope([{ table: 'tasks', id, outcome: 'applied' }])
                : pullEnvelope()
        )
        await new SyncService(requester).pushAll()

        const deletions = pushBodyOf(post).deletions as RawRecord[]
        // 逐字不变：恰好两个键（无 baseUpdatedAt）
        expect(deletions).toHaveLength(1)
        expect(Object.keys(deletions[0]!).sort()).toEqual(['id', 'table'])
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)
        expect(await loadConflictJournal(USER_ID)).toHaveLength(0)
    })
})

describe('T641 / A4 能力探测（回执是否有 outcome）', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('AC4 回执带 outcome ⇒ 认定服务端支持删除裁决（deletionOCCSupported=true）—— 现状红', async () => {
        const id = await makeTask('带 outcome 删除')
        await seedBase(id, BASE)
        expect(await newLocalTaskRepository().remove(id)).toBeNull()

        const { requester } = makeRequester((url) =>
            url === '/sync/push'
                ? pushEnvelope([{ table: 'tasks', id, outcome: 'applied' }])
                : pullEnvelope()
        )
        await new SyncService(requester).pushAll()

        expect(deletionOCCSupported(), '能力探测信号未落地（形状待实现确认）').toBe(true)
    })

    it('AC4 回执无 outcome（老服务端）⇒ 不得认定已裁决（deletionOCCSupported=false，且不伪造 stale 记录）—— 现状红', async () => {
        const id = await makeTask('无 outcome 删除')
        await seedBase(id, BASE)
        expect(await newLocalTaskRepository().remove(id)).toBeNull()

        const { requester } = makeRequester((url) =>
            // 老服务端：回显删除结果但不带 outcome
            url === '/sync/push' ? pushEnvelope([{ table: 'tasks', id }]) : pullEnvelope()
        )
        await new SyncService(requester).pushAll()

        expect(deletionOCCSupported()).toBe(false)
        // 不得据「没收到 stale」伪造裁决/冲突记录
        expect(await loadConflictJournal(USER_ID)).toHaveLength(0)
    })
})