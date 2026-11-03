// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import {
    CreateTaskValueObject,
    type TaskEntity,
    UpdateTaskValueObject
} from '@nao-todo/domain-task'
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
 * T641 / `A1`（`F-01`）用例先行（红基线）—— **拉取「本地胜」分支必须落冲突记账**
 *
 * 契约真源：`docs/prds/2026-11-03-data-sync-a-batch.md`（AC1 · R-B · R-H）
 *          · `docs/reports/T640-sync-a-batch-arch-review.md` **Q2**（触发判据 / 新 kind
 *          `pull-local-wins` / 墓碑硬约束 / 去重 / 有界）
 *          · `docs/adr/2026-11-03-sync-conflict-journal-crypto.md`（快照最小化）
 *
 * 覆盖（现状**红**）：
 * ① 触发判据（`queued` + `remoteTs <= localTs` + 逐字段 diff 非空）⇒ journal **恰 1 条**
 *    `pull-local-wins`，`loser` = **远端快照**（将被本地覆盖的那一版），且**只含差异字段 + 身份字段**；
 * ② 重复 pull ⇒ 仍 **1 条**（`occurrences` 递增，不追加）；
 * ③ **墓碑特例（硬约束）**：远端为墓碑 ⇒ **不得**走本地胜分支（必须：墓碑生效 + 出队 + journal 本地内容，
 *    kind 不得为 `pull-local-wins`）⇒ 否则下一步 push 的 base 恰等于墓碑版本，服务端判 `Overwrite`
 *    并清 `deleted_at` ⇒ **确定性复活**（`F-04` 复活主因）。
 *
 * 红基线原因（现状）：本地胜分支只 `writeBackSyncBase`，**不写 journal**（`sync-service.ts`
 * `applyPullBatch` 的 else 分支）；`pull-local-wins` kind / `occurrences` / 墓碑特判均未落地。
 *
 * ⚠️ 边界：只读 `sync-service` / `conflict-journal` 导出面，不改产品代码。
 */

const USER_ID = 't641-a1-user'
/** 队列 `localUpdatedAt` 置于远期 ⇒ pull 判「本地胜」（`remoteTs <= localTs`） */
const FUTURE_LOCAL_TS = '2030-01-01T00:00:00.000Z'
const REMOTE_TS = '2029-01-01T00:00:00.000Z'
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

type RawRecord = Record<string, unknown>

const mockRequester = (handler: (url: string, body: unknown) => unknown): Requester =>
    ({
        post: async (url: string, body: unknown) => ({ data: handler(url, body) }),
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    }) as unknown as Requester

/** 真实服务端 pull 响应体：`body.data = { data: { <table>: ... }, serverTime }` */
const pullEnvelope = (tables: Record<string, unknown> = {}, serverTime = Date.now()) => ({
    code: 90020,
    message: 'ok',
    data: {
        data: { ...EMPTY_PULL_DATA, ...tables },
        serverTime: String(serverTime)
    }
})

const taskVO = (name: string, description = ''): CreateTaskValueObject =>
    new CreateTaskValueObject(
        null,
        null,
        name,
        description,
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
    localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-t641-a1')
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
    syncStatus.setConflictCount(0)
}

const makeTask = async (name: string): Promise<TaskEntity> => {
    const repo = newLocalTaskRepository()
    const [task, err] = await repo.create(taskVO(name))
    expect(err).toBeNull()
    return task as TaskEntity
}

/** 把该实体队列项的 `localUpdatedAt` 置于远期（模拟「本地待推修改晚于远端」） */
const markLocalQueueLater = async (id: string): Promise<void> => {
    const key = `${USER_ID}:tasks:${id}`
    const queued = await localDatabase.syncQueue.get(key)
    expect(queued, '夹具前置：任务应已入队（本地待推）').toBeTruthy()
    await localDatabase.syncQueue.put({ ...queued!, localUpdatedAt: FUTURE_LOCAL_TS })
}

/**
 * 由本地实体造一条「服务端 sync 条目形状」的远端行。
 * @description 默认**除 `name` / `updatedAt` 外逐字段与本地一致** ⇒ 差异集只有 name（可精确断言
 *              「diff 只含差异字段」）。
 */
const remoteTaskFrom = (
    local: TaskEntity,
    over: { updatedAt: string; name?: string; deletedAt?: string | null }
): RawRecord => ({
    id: local.id,
    createdAt: local.createdAt,
    updatedAt: over.updatedAt,
    deletedAt: over.deletedAt ?? null,
    parentTaskId: local.parentTaskId,
    name: over.name ?? local.name,
    description: local.description,
    state: local.state,
    priority: local.priority,
    startAt: local.startAt,
    endAt: local.endAt,
    projectId: local.projectId,
    tags: [...local.tags],
    archivedAt: local.archivedAt,
    starMarkAt: local.starMarkAt,
    givenUpAt: local.givenUpAt,
    remindAt: local.remindAt,
    remindRepeat: local.remindRepeat,
    remindTime: local.remindTime,
    remindWeekdays: [...local.remindWeekdays],
    checkItemCount: local.checkItemCount,
    commentCount: local.commentCount,
    subtaskCount: local.subtaskCount,
    sortId: local.sortId
})

const rawTaskOf = async (id: string): Promise<RawRecord | undefined> =>
    (await localDatabase.tasks.get(id)) as unknown as RawRecord | undefined

const baseOf = async (id: string): Promise<unknown> => (await rawTaskOf(id))?.syncedServerUpdatedAt

describe('T641 / A1 拉取「本地胜」记账', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('AC1 本地胜 ⇒ journal 恰 1 条 pull-local-wins（loser=远端快照 · 只含差异字段）', async () => {
        const local = await makeTask('本地名')
        const id = local.id
        await markLocalQueueLater(id)

        const remote = remoteTaskFrom(local, { updatedAt: REMOTE_TS, name: '远端名' })
        const service = new SyncService(
            mockRequester((url) =>
                url === '/sync/pull'
                    ? pullEnvelope({
                          tasks: { ...EMPTY_TABLE, items: [remote], total: 1 }
                      })
                    : { data: {} }
            )
        )

        await service.pullAll()

        const entries = await loadConflictJournal(USER_ID)
        // 现状红：本地胜分支不写 journal
        expect(entries).toHaveLength(1)
        const entry = entries[0]!
        // 必须新开 kind（复用 remote-wins 会把 loser 当本地版本重推 / Q2 硬约束）
        expect(String(entry.kind)).toBe('pull-local-wins')
        expect(entry.table).toBe('tasks')
        expect(entry.entityId).toBe(id)
        // loser = **远端**快照（将被本地覆盖的那一版）
        const loser = entry.loser as RawRecord
        expect(loser.id).toBe(id)
        expect(loser.name).toBe('远端名')
        // winner = 本地（队列项时间）；loser 时间 = 远端 updatedAt
        expect(entry.winnerUpdatedAt).toBe(FUTURE_LOCAL_TS)
        expect(entry.loserUpdatedAt).toBe(REMOTE_TS)
        // 快照最小化（R-H）：只存 diff 涉及的字段 + 身份字段，**禁整行复制**
        expect(Object.keys(loser)).not.toContain('updatedAt')
        expect(Object.keys(loser)).not.toContain('description')
        expect(Object.keys(loser)).not.toContain('priority')
        expect(Object.keys(loser)).not.toContain('state')
        expect(Object.keys(loser)).not.toContain('projectId')
        expect(Object.keys(loser)).not.toContain('tags')
        expect(Object.keys(loser)).not.toContain('sortId')
        expect(Object.keys(loser).length).toBeLessThanOrEqual(3)

        // 既有行为不得回退：本地胜仍收敛 base（否则下次 push 必然 stale）
        expect(await baseOf(id)).toBe(REMOTE_TS)
        // 本地胜：本地行内容不被覆盖、队列项保留
        expect((await rawTaskOf(id))?.name).not.toBe('远端名')
        expect(await syncTracker.countDirty(USER_ID)).toBe(1)
    })

    it('AC1 重复 pull ⇒ 仍 1 条（occurrences 递增，不追加）', async () => {
        const local = await makeTask('本地名')
        const id = local.id
        await markLocalQueueLater(id)

        const remote = remoteTaskFrom(local, { updatedAt: REMOTE_TS, name: '远端名' })
        const service = new SyncService(
            mockRequester((url) =>
                url === '/sync/pull'
                    ? pullEnvelope({
                          tasks: { ...EMPTY_TABLE, items: [remote], total: 1 }
                      })
                    : { data: {} }
            )
        )

        await service.pullAll()
        await service.pullAll()

        const entries = await loadConflictJournal(USER_ID)
        // 现状红：0 条；实现后 = 1 条（去重）
        expect(entries.filter((entry) => String(entry.kind) === 'pull-local-wins')).toHaveLength(1)
        // 去重判据 `(table, entityId, kind, winnerUpdatedAt)` 已存在 ⇒ 仅 occurrences += 1
        const occurrences = (entries[0] as unknown as { occurrences?: number }).occurrences
        expect(occurrences).toBe(2)
    })

    it('DEF-135 写入侧判等归一：远端 `""` vs 本地 `null` 不算差异 ⇒ 不记账（禁「写侧记差异、读侧判相等」）', async () => {
        const local = await makeTask('同名任务')
        const id = local.id
        await markLocalQueueLater(id)

        // 除「空值哨兵的写法」外与本地逐字段一致：远端归档/星标写 `''`，本地为 `null`
        const remote: RawRecord = {
            ...remoteTaskFrom(local, { updatedAt: REMOTE_TS }),
            archivedAt: '',
            starMarkAt: ''
        }
        const service = new SyncService(
            mockRequester((url) =>
                url === '/sync/pull'
                    ? pullEnvelope({ tasks: { ...EMPTY_TABLE, items: [remote], total: 1 } })
                    : { data: {} }
            )
        )

        await service.pullAll()

        // 归一后逐字段 diff 为空 ⇒ 不是一次「会丢数据的裁决」⇒ 不记账
        expect(await loadConflictJournal(USER_ID)).toHaveLength(0)
        // 既有行为不回退：本地胜仍收敛 base、队列项保留
        expect(await baseOf(id)).toBe(REMOTE_TS)
        expect(await syncTracker.countDirty(USER_ID)).toBe(1)
    })

    it('AC1 墓碑特例（硬约束）：远端为墓碑 ⇒ 墓碑生效 + 出队 + 不复活 + journal 本地内容', async () => {
        const local = await makeTask('本地名')
        const id = local.id
        // 本地离线改名（待推）
        const repo = newLocalTaskRepository()
        const vo = new UpdateTaskValueObject(id)
        vo.name = '本地改名'
        expect(await repo.update(id, vo)).toBeNull()
        await markLocalQueueLater(id)

        // 远端是墓碑，且 `remoteTs <= localTs`（照现状会误走「本地胜」⇒ 复活）
        const remote = remoteTaskFrom(local, {
            updatedAt: REMOTE_TS,
            name: '本地改名',
            deletedAt: REMOTE_TS
        })
        const pushCalls: string[] = []
        const service = new SyncService(
            mockRequester((url) => {
                if (url === '/sync/pull') {
                    return pullEnvelope({
                        tasks: { ...EMPTY_TABLE, items: [remote], total: 1 }
                    })
                }
                pushCalls.push(url)
                return { data: { data: { results: [], serverTime: String(Date.now()) } } }
            })
        )

        await service.pullAll()

        const entries = await loadConflictJournal(USER_ID)
        // 墓碑必须改走「远端胜」路径：kind 不得是 pull-local-wins（Q2 硬约束）
        expect(entries).toHaveLength(1)
        const entry = entries[0]!
        expect(String(entry.kind)).toBe('remote-wins')
        expect(String(entry.kind)).not.toBe('pull-local-wins')
        // 落一条**本地内容**的记录（用户能看到自己丢掉的那次编辑）
        expect((entry.loser as RawRecord).name).toBe('本地改名')
        expect(entry.winnerUpdatedAt).toBe(REMOTE_TS)
        // 墓碑生效：本地行落墓碑
        expect((await rawTaskOf(id))?.deletedAt).toBe(REMOTE_TS)
        // 出队（不得保留本地编辑意图）
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)
        // base 收敛到墓碑版本 ⇒ 下一步 push 不得拿旧 base 去清服务端 deleted_at
        expect(await baseOf(id)).toBe(REMOTE_TS)

        // 不复活：队列已空 ⇒ 下一轮 push 不得把该任务当 upsert 发出去
        const pushBodies: RawRecord[] = []
        const post = vi.fn(async (_url: string, body: unknown) => {
            pushBodies.push(body as RawRecord)
            return { data: { data: { results: [] } } }
        })
        const service2 = new SyncService({
            post,
            get: async () => ({ data: {} }),
            put: async () => ({ data: {} }),
            delete: async () => ({ data: {} })
        } as unknown as Requester)
        await service2.pushAll()
        const pushedTasks = (pushBodies.at(-1)?.tasks as RawRecord[] | undefined) ?? []
        expect(pushedTasks ?? []).toHaveLength(0)
        // 初次 pull 期间也不得产生 push 请求（先拉后推由调用方决定）
        expect(pushCalls).toHaveLength(0)
    })
})