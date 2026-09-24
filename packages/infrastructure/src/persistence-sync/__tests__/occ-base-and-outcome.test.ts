// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { CreateTaskValueObject, UpdateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import { loadConflictJournal } from '../conflict-journal'
import { syncStatus } from '../sync-status'
import { syncTracker } from '../sync-tracker'
import { SyncService } from '../sync-service'

/**
 * T162 用例先行（红基线）—— 阶段二 2B · 客户端面
 *
 * 覆盖（ADR `2026-09-24-stage2-both-ends-local-first.md` §9.1 / §9.6 R-10…R-15 / DP-2B-1…4）：
 *
 * **面 ① OCC base 生命周期（§9.1.2 / §9.1.4 / §9.1.5 / §9.1.6-(i)）**
 * - pull ⇒ 落 `syncedServerUpdatedAt`（R-13）；
 * - 本地写**保留** base（R-20 灾难路径）；
 * - push 逐条携带 `baseUpdatedAt`（§9.1.2）；
 * - **base 缺失 ⇒ 不产出 `baseUpdatedAt`**（现行 LWW 零变化，向后兼容 / R-12）—— 现状已绿；
 * - push `applied` ⇒ 以 `serverUpdatedAt` 写回 base（§9.1.6 写回点）。
 *
 * **面 ② 全 outcome 消费（§9.1.4 / §9.6 R-15 / R-18 / DP-2B-4）**
 * - `stale` ⇒ journal（含败方快照）+ 写回库中版本 + 出队 + 可见计数；
 * - `stale` 与 `conflict`（ID 碰撞）语义**可分流**（conflict 不得记成 `stale`、不得静默出队）；
 * - `error` ⇒ **不出队** + 业务退避（attempts/nextAttemptAt）。
 *
 * ⚠️ `skipped` 的「可见性」**未纳入**：既有绿测 `conflict-journal.test.ts`
 *    「push outcome=applied / skipped ⇒ 不记 journal」已覆盖同一契约且与 ADR §9.1.4
 *    「登记」措辞存在解释张力 ⇒ 按派单要求**不覆盖他人用例**，回报 PM 裁定。
 *
 * **红窗口**：除「base 缺失」（现状绿）外，其余预期**红**（T164/W2 落地后转绿）。
 */

const USER_ID = 'occ-base-user'
const BASE = '2026-01-02T00:00:00.000Z'
const NEWER = '2026-01-03T00:00:00.000Z'
const EMPTY_TABLE = { items: [], total: 0, nextCursor: '', nextCursorId: '' }

type RawRecord = Record<string, unknown>

/** 远程任务 payload（字段与 `taskRes2TaskEntity` 契约一致；对齐 pull-single-master 测试） */
const remoteTask = (id: string, updatedAt: string, name = '远端名'): RawRecord => ({
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt,
    deletedAt: null,
    parentTaskId: null,
    name,
    description: '',
    state: 'todo',
    priority: 'medium',
    startAt: null,
    endAt: null,
    projectId: null,
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
    sortId: 0
})

/** 本地任务记录（未解密快照；仅用于读/补写 per-row base） */
const rawTask = async (id: string): Promise<RawRecord | undefined> =>
    (await localDatabase.tasks.get(id)) as unknown as RawRecord | undefined

/** 本地 per-row base（§9.1.6-(i) `syncedServerUpdatedAt`；缺失 ⇒ undefined） */
const baseOf = async (id: string): Promise<unknown> => (await rawTask(id))?.syncedServerUpdatedAt

/** 直接给本地行补写 base（模拟「上一轮同步已落 base」的前置态；不触发 markDirty） */
const seedBase = async (id: string, value: string): Promise<void> => {
    const record = (await rawTask(id)) ?? {}
    await localDatabase.tasks.put({ ...record, syncedServerUpdatedAt: value } as never)
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
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
    syncStatus.setConflictCount(0)
}

/** 建本地任务（经本地仓储 ⇒ 已 markDirty 入 syncQueue） */
const makeTask = async (name = 'OCC 任务'): Promise<string> => {
    const repo = newLocalTaskRepository()
    const [task, err] = await repo.create(
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
    )
    expect(err).toBeNull()
    return (task as { id: string }).id
}

/** push 响应条目 */
interface PushResultStub {
    table: string
    id: string
    serverUpdatedAt?: string
    outcome?: string
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

/** 取 push 请求体中某表条目（`post` 第 2 参 = body） */
const pushItems = (post: ReturnType<typeof vi.fn>, table: string): RawRecord[] => {
    const body = post.mock.calls[0]?.[1] as { [key: string]: RawRecord[] } | undefined
    return body?.[table] ?? []
}

const pushStub = (result: PushResultStub): ((url: string) => unknown) => {
    return (url: string) =>
        url === '/sync/push'
            ? { data: { results: [result] }, serverTime: Date.now() }
            : { data: {} }
}

describe('面 ① OCC base 生命周期', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('pull ⇒ 本地落 syncedServerUpdatedAt = 服务端 updatedAt（§9.1.5 / R-13）', async () => {
        const { requester } = makeRequester((url) => {
            if (url === '/sync/pull') {
                return {
                    data: {
                        data: {
                            tasks: {
                                items: [remoteTask('t-occ-pull', BASE)],
                                total: 1,
                                nextCursor: '',
                                nextCursorId: ''
                            },
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
            return { data: {} }
        })

        await new SyncService(requester).pullAll()

        expect(await baseOf('t-occ-pull')).toBe(BASE)
    })

    it('本地写保留 base（§9.1.6-(i) / R-20 灾难路径）', async () => {
        const id = await makeTask()
        await seedBase(id, BASE)

        const vo = new UpdateTaskValueObject(id)
        vo.name = '改名后'
        const err = await newLocalTaskRepository().update(id, vo)

        expect(err).toBeNull()
        expect(await baseOf(id)).toBe(BASE)
    })

    it('push 逐条携带 baseUpdatedAt（§9.1.2 / R-10）', async () => {
        const id = await makeTask()
        await seedBase(id, BASE)
        const { requester, post } = makeRequester(
            pushStub({ table: 'tasks', id, serverUpdatedAt: NEWER, outcome: 'applied' })
        )

        await new SyncService(requester).pushAll()

        const items = pushItems(post, 'tasks')
        expect(items).toHaveLength(1)
        expect(items[0]?.baseUpdatedAt).toBe(BASE)
    })

    it('base 缺失 ⇒ 不产出 baseUpdatedAt（现行 LWW 零变化 · 向后兼容 / R-12）—— 现状已绿', async () => {
        const id = await makeTask()
        const { requester, post } = makeRequester(
            pushStub({ table: 'tasks', id, serverUpdatedAt: NEWER, outcome: 'applied' })
        )

        await new SyncService(requester).pushAll()

        const items = pushItems(post, 'tasks')
        expect(items).toHaveLength(1)
        expect(items[0]?.id).toBe(id)
        expect(items[0]?.baseUpdatedAt).toBeUndefined()
    })

    it('push applied ⇒ 以 serverUpdatedAt 写回 base（§9.1.6 写回点 / R-13）', async () => {
        const id = await makeTask()
        await seedBase(id, BASE)
        const { requester } = makeRequester(
            pushStub({ table: 'tasks', id, serverUpdatedAt: NEWER, outcome: 'applied' })
        )

        await new SyncService(requester).pushAll()

        expect(await baseOf(id)).toBe(NEWER)
    })
})

describe('面 ② 全 outcome 消费', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('push stale ⇒ journal（kind=stale + 败方快照）+ 写回库中版本 + 出队 + 可见计数（§9.1.4 / R-15）', async () => {
        const id = await makeTask('本地被拒名')
        await seedBase(id, BASE)
        const { requester } = makeRequester(
            pushStub({ table: 'tasks', id, serverUpdatedAt: NEWER, outcome: 'stale' })
        )

        await new SyncService(requester).pushAll()

        const entries = await loadConflictJournal(USER_ID)
        expect(entries).toHaveLength(1)
        expect(String(entries[0]!.kind)).toBe('stale')
        expect(entries[0]!.table).toBe('tasks')
        expect(entries[0]!.entityId).toBe(id)
        expect((entries[0]!.loser as RawRecord).name).toBe('本地被拒名')
        expect(entries[0]!.winnerUpdatedAt).toBe(NEWER)
        // stale 回执带库中当前版本 ⇒ 写回 base，使下次推送以新 base 命中（§9.1.3 / §9.1.6）
        expect(await baseOf(id)).toBe(NEWER)
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)
        expect(syncStatus.get().conflictCount).toBe(1)
    })

    it('stale 与 conflict 语义分流：conflict 不得记成 stale，且不得静默出队（§9.1.4 / R-15）', async () => {
        const id = await makeTask('ID 碰撞任务')
        await seedBase(id, BASE)
        const { requester } = makeRequester(
            pushStub({ table: 'tasks', id, serverUpdatedAt: NEWER, outcome: 'conflict' })
        )

        await new SyncService(requester).pushAll()

        const entries = await loadConflictJournal(USER_ID)
        // 可见（登记）：不得静默出队
        expect(entries.length).toBeGreaterThan(0)
        expect(entries[0]!.entityId).toBe(id)
        // 与 stale 可分流（补救动作不同：conflict = 重生成 id）
        expect(String(entries[0]!.kind)).not.toBe('stale')
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)
    })

    it('push error ⇒ 不出队 + 业务退避（§9.1.4 / R-15 / R-18 / DP-2B-4）', async () => {
        const id = await makeTask()
        const { requester } = makeRequester(
            pushStub({ table: 'tasks', id, serverUpdatedAt: NEWER, outcome: 'error' })
        )

        await new SyncService(requester).pushAll()

        // R-18 P0：error 未消费会「服务端失败但客户端已出队」⇒ 本地改动静默丢失
        expect(await syncTracker.countDirty(USER_ID)).toBe(1)
        const queue = await syncTracker.listDirty(USER_ID)
        expect(queue).toHaveLength(1)
        expect(queue[0]!.attempts ?? queue[0]!.retryCount).toBeGreaterThan(0)
        expect(queue[0]!.nextAttemptAt).toBeTruthy()
    })
})