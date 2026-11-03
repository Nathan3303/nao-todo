// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import {
    CreateTaskValueObject,
    type TaskEntity,
    UpdateTaskValueObject
} from '@nao-todo/domain-task'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase, type TaskRecord } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import {
    appendConflict,
    loadConflictJournal,
    resolveConflictKeepServer,
    type ConflictJournalInput,
    type ConflictResolutionResult
} from '../conflict-journal'
import { syncStatus } from '../sync-status'
import { syncTracker } from '../sync-tracker'
import { SyncService } from '../sync-service'

/**
 * T641 / `A2`（`F-02`）用例先行（红基线）—— **「保留服务端」必须真写回本地**
 *
 * 契约真源：`docs/reports/T640-sync-a-batch-arch-review.md` **Q3**（`serverCurrent` / 四条例外 /
 *          单事务 / base 只前进 / 旧服务端降级两态）· PRD `R-E` / AC2。
 *
 * 覆盖（现状**红**，除标注「现绿护栏」者）：
 * ① `stale` 条目点「保留服务端」⇒ 本地行**逐字段 == `serverCurrent`**、`syncedServerUpdatedAt ==
 *    `serverUpdatedAt`、队列清空、journal 清空；随后再编辑 ⇒ push 携带**新 base** ⇒ 回执 `applied`；
 * ② 四条例外（**逐条**，按评审原文，不简化成 happy path）：
 *    ① 本地又有新编辑 ⇒ 拒绝写回 + 保留条目 + 本地编辑不丢；
 *    ② 删除中 ⇒ 不复活 + 保留删除意图 + 清条目；
 *    ③ 解密/转换失败 ⇒ fail-soft：不改行 + 不清条目 + 可见失败；
 *    ④ 快照已过期（服务端版本已新于 `serverCurrent`）⇒ base 只前进不回退，不得写回旧快照；
 * ③ 旧服务端（回执**无** `serverCurrent`）⇒ UI 两态「将在下次同步后生效」，**不得假装成功**。
 *
 * **PM 冻结形状（2026-11-03，T641 轮次 1 验收后）**：
 * - push 回执的 `stale` 条目携带 additive `serverCurrent`（sync 条目形状）；
 * - journal 条目持久化 `serverCurrent`（`entry.serverCurrent`，写回时从条目取，无额外往返）；
 * - `resolveConflictKeepServer` 返回 `{ ok: boolean; pendingNextSync?: true; error?: string }`
 *   （旧服务端 ⇒ `pendingNextSync: true`，**不得** `ok:true` 假装生效）。
 *
 * ⚠️ `remote-wins` / `push-noop` 条目的「仅清条目」语义**不变**（由既有
 *    `conflict-ux-api.test.ts` 守护）；本文件只针对 `stale`（`F-02` 真实路径）。
 */

const USER_ID = 't641-a2-user'
const SERVER_V1 = '2029-01-01T00:00:00.000Z'
const SERVER_V2 = '2029-06-01T00:00:00.000Z'
const SERVER_V3 = '2029-09-01T00:00:00.000Z'
const EMPTY_PULL_DATA = {
    tasks: { items: [], total: 0, nextCursor: '', nextCursorId: '' },
    projects: { items: [], total: 0, nextCursor: '', nextCursorId: '' },
    tags: { items: [], total: 0, nextCursor: '', nextCursorId: '' },
    taskCheckItems: { items: [], total: 0, nextCursor: '', nextCursorId: '' },
    taskComments: { items: [], total: 0, nextCursor: '', nextCursorId: '' },
    pomodoros: { items: [], total: 0, nextCursor: '', nextCursorId: '' },
    pomodoroRecords: { items: [], total: 0, nextCursor: '', nextCursorId: '' }
}

type RawRecord = Record<string, unknown>

const mockRequester = (handler: (url: string, body: unknown) => unknown): Requester =>
    ({
        post: async (url: string, body: unknown) => ({ data: handler(url, body) }),
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    }) as unknown as Requester

const pushEnvelope = (results: unknown[], serverTime = Date.now()) => ({
    code: 90010,
    message: 'ok',
    data: { results, serverTime: String(serverTime) }
})

const pullEnvelope = (tables: Record<string, unknown> = {}, serverTime = Date.now()) => ({
    code: 90020,
    message: 'ok',
    data: { data: { ...EMPTY_PULL_DATA, ...tables }, serverTime: String(serverTime) }
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
    localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'jwt-t641-a2')
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

const rawTaskOf = async (id: string): Promise<RawRecord | undefined> =>
    (await localDatabase.tasks.get(id)) as unknown as RawRecord | undefined

const baseOf = async (id: string): Promise<unknown> => (await rawTaskOf(id))?.syncedServerUpdatedAt

/** 服务端行（sync 条目形状；A2 的写回源） */
const serverCurrentTask = (local: TaskEntity, over: Partial<RawRecord> = {}): RawRecord => ({
    id: local.id,
    createdAt: local.createdAt,
    deletedAt: null,
    parentTaskId: local.parentTaskId,
    name: local.name,
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
    sortId: local.sortId,
    ...over,
    updatedAt: SERVER_V2
})

/** journal 条目上的 `serverCurrent`（A2 期望形状；未落地 ⇒ undefined） */
const serverCurrentOf = (entry: unknown): RawRecord | undefined =>
    (entry as { serverCurrent?: RawRecord }).serverCurrent

/** 动作结果「待下次同步生效」（PM 冻结形状：`pendingNextSync?: true`） */
const isPendingNextSync = (result: ConflictResolutionResult): boolean =>
    (result as unknown as { pendingNextSync?: boolean }).pendingNextSync === true

/** 直接追加一条 `stale` journal 条目（带 additive `serverCurrent`） */
const appendStaleEntry = async (
    local: TaskEntity,
    current: RawRecord,
    loserName = '我的被拒修改'
): Promise<void> => {
    await appendConflict(USER_ID, {
        kind: 'stale',
        table: 'tasks',
        entityId: local.id,
        loser: { id: local.id, name: loserName },
        winnerUpdatedAt: SERVER_V2,
        loserUpdatedAt: SERVER_V1,
        serverCurrent: current
    } as unknown as ConflictJournalInput)
}

/** 一次真实的 `stale` push（回执带 additive `serverCurrent`） */
const pushStaleWithServerCurrent = async (id: string, current: RawRecord): Promise<void> => {
    const service = new SyncService(
        mockRequester((url) =>
            url === '/sync/push'
                ? pushEnvelope([
                      {
                          table: 'tasks',
                          id,
                          outcome: 'stale',
                          serverUpdatedAt: SERVER_V2,
                          serverCurrent: current
                      }
                  ])
                : pullEnvelope()
        )
    )
    await service.pushAll()
}

describe('T641 / A2 「保留服务端」写回（正常路径）', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('AC2 stale ⇒ 逐字段 == serverCurrent + base 更新 + 队列/journal 清空；再编辑 push 带新 base ⇒ applied', async () => {
        const local = await makeTask('我的名字')
        const id = local.id
        const current = serverCurrentTask(local, {
            name: '云端最新名',
            description: '云端说明',
            state: 'done',
            priority: 'high',
            projectId: 'p-2',
            tags: ['tag-a'],
            remindRepeat: 'daily',
            remindTime: '09:00',
            remindAt: '2029-05-01T08:00:00.000Z'
        })

        await pushStaleWithServerCurrent(id, current)

        // 前置：stale 条目已落账，且**持久化了服务端行**（否则动作无法离线写回）
        const seeded = await loadConflictJournal(USER_ID)
        expect(seeded).toHaveLength(1)
        expect(String(seeded[0]!.kind)).toBe('stale')
        expect(
            serverCurrentOf(seeded[0])?.name,
            'A2 前置缺口：journal 未持久化 serverCurrent'
        ).toBe('云端最新名')

        const result = await resolveConflictKeepServer(USER_ID, 'tasks', id)
        expect(result.ok).toBe(true)

        const [after, err] = await newLocalTaskRepository().get(id)
        expect(err).toBeNull()
        const entity = after as TaskEntity
        // 逐字段 == 服务端行（AC2「本地行 = 服务端行」）
        expect(entity.name).toBe('云端最新名')
        expect(entity.description).toBe('云端说明')
        expect(entity.state).toBe('done')
        expect(entity.priority).toBe('high')
        expect(entity.projectId).toBe('p-2')
        expect(entity.tags).toEqual(['tag-a'])
        expect(entity.remindRepeat).toBe('daily')
        expect(entity.remindTime).toBe('09:00')
        expect(entity.remindAt).toBe('2029-05-01T08:00:00.000Z')
        expect(entity.updatedAt).toBe(SERVER_V2)
        expect(entity.deletedAt).toBeNull()
        // base 更新为回执的 serverUpdatedAt
        expect(await baseOf(id)).toBe(SERVER_V2)
        // 队列清空（动作不得重新入队/触发推送）
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)
        // journal 条目清除
        expect(await loadConflictJournal(USER_ID)).toHaveLength(0)

        // 再编辑 ⇒ push 必须携带**新 base**（= SERVER_V2）⇒ 服务端回 applied（不再覆盖他端字段）
        const updateVo = new UpdateTaskValueObject(id)
        updateVo.name = '我的再编辑'
        expect(await newLocalTaskRepository().update(id, updateVo)).toBeNull()

        const pushBodies: RawRecord[] = []
        const service = new SyncService(
            mockRequester((url, body) => {
                if (url !== '/sync/push') return pullEnvelope()
                pushBodies.push(body as RawRecord)
                const base = (body as { tasks?: RawRecord[] }).tasks?.[0]?.baseUpdatedAt
                return pushEnvelope([
                    {
                        table: 'tasks',
                        id,
                        // base 命中 ⇒ applied；沿用旧 base ⇒ 服务端回 stale ⇒ 会产生新 journal 条目（被下面断言捕获）
                        outcome: base === SERVER_V2 ? 'applied' : 'stale',
                        serverUpdatedAt: SERVER_V3
                    }
                ])
            })
        )
        await service.pushAll()

        expect(pushBodies).toHaveLength(1)
        expect((pushBodies[0]!.tasks as RawRecord[])[0]?.baseUpdatedAt).toBe(SERVER_V2)
        expect((pushBodies[0]!.tasks as RawRecord[])[0]?.name).toBe('我的再编辑')
        expect(await baseOf(id)).toBe(SERVER_V3)
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)
        expect(await loadConflictJournal(USER_ID)).toHaveLength(0)
    })

    it('重复点击（条目已清）⇒ no-op（不报错、不再改行）—— 现绿护栏', async () => {
        const local = await makeTask('我的名字')
        const id = local.id
        await appendStaleEntry(local, serverCurrentTask(local, { name: '云端名' }))

        expect((await resolveConflictKeepServer(USER_ID, 'tasks', id)).ok).toBe(true)
        const afterFirst = (await newLocalTaskRepository().get(id))[0]

        const again = await resolveConflictKeepServer(USER_ID, 'tasks', id)
        expect(again.remaining).toBe(0)
        // 幂等：重复点击不产生额外副作用（行内容不再变化）
        expect((await newLocalTaskRepository().get(id))[0]?.name).toBe(afterFirst?.name)
        expect(await loadConflictJournal(USER_ID)).toHaveLength(0)
    })
})

describe('T641 / A2 四条例外（必须不写回）', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('例外 ①：本地又有新编辑 ⇒ 拒绝写回 + 保留条目 + 本地编辑不丢', async () => {
        const local = await makeTask('原名')
        const id = local.id
        await appendStaleEntry(local, serverCurrentTask(local, { name: '云端名' }))

        // 记账之后本地又编辑了同类实体（队列 revision / localUpdatedAt 晚于条目 at）
        const updateVo = new UpdateTaskValueObject(id)
        updateVo.name = '记账后的新编辑'
        expect(await newLocalTaskRepository().update(id, updateVo)).toBeNull()
        const key = `${USER_ID}:tasks:${id}`
        const queued = await localDatabase.syncQueue.get(key)
        await localDatabase.syncQueue.put({
            ...queued!,
            localUpdatedAt: '2999-01-01T00:00:00.000Z'
        })

        const result = await resolveConflictKeepServer(USER_ID, 'tasks', id)

        // 不得静默丢新编辑
        expect((await newLocalTaskRepository().get(id))[0]?.name).toBe('记账后的新编辑')
        expect(result.ok).toBe(false)
        // 条目保留（可见 + 待用户再决定）
        expect(await loadConflictJournal(USER_ID)).toHaveLength(1)
        // 新编辑的队列项不得被清掉
        expect(await syncTracker.countDirty(USER_ID)).toBe(1)
    })

    it('例外 ②：删除中 ⇒ 不复活 + 保留删除意图 + 清条目', async () => {
        const local = await makeTask('将被删除的任务')
        const id = local.id
        await appendStaleEntry(local, serverCurrentTask(local, { name: '云端名' }))

        // 删除中：队列 action='delete' + 本地 deletedAt 非空
        expect(await newLocalTaskRepository().remove(id)).toBeNull()

        await resolveConflictKeepServer(USER_ID, 'tasks', id)

        const raw = await rawTaskOf(id)
        // 不复活：不得把服务端行写回成活动行
        expect(raw).toBeTruthy()
        expect(raw?.deletedAt).not.toBeNull()
        expect(raw?.name).not.toBe('云端名')
        // 保留删除意图（队列仍是 delete）
        const queue = await syncTracker.listDirty(USER_ID)
        expect(queue).toHaveLength(1)
        expect(queue[0]!.action).toBe('delete')
        // 条目清除（删除意图优先，动作已完成）
        expect(await loadConflictJournal(USER_ID)).toHaveLength(0)
    })

    it('例外 ③：解密/转换失败（历史密文无 DEK）⇒ 不改行 + 不清条目 + 可见失败', async () => {
        const local = await makeTask('原名')
        const id = local.id
        await appendStaleEntry(local, serverCurrentTask(local, { name: '云端名' }))

        // 本地行存历史密文（非 `plain:` 前缀），且 DEK 未解锁 ⇒ 任何读当前行的 decrypt 都会抛错
        const raw = await rawTaskOf(id)
        await localDatabase.tasks.put({
            ...(raw as unknown as TaskRecord),
            name: 'AAAA:BBBB'
        })
        cryptoService.lock()

        const result = await resolveConflictKeepServer(USER_ID, 'tasks', id)

        // fail-soft：不写回、不吞条目、有可见失败
        expect(result.ok).toBe(false)
        expect(await rawTaskOf(id)).toMatchObject({ name: 'AAAA:BBBB' })
        expect(await loadConflictJournal(USER_ID)).toHaveLength(1)
    })

    it('例外 ④：快照已过期（服务端版本已新于 serverCurrent）⇒ base 只前进不回退，不写回旧快照', async () => {
        const local = await makeTask('本地当前名')
        const id = local.id
        await appendStaleEntry(local, serverCurrentTask(local, { name: '云端旧快照名' }))

        // 服务端版本已前进到 V3（本地 base 已收敛到 V3）
        await localDatabase.tasks.update(id, { syncedServerUpdatedAt: SERVER_V3 })

        const result = await resolveConflictKeepServer(USER_ID, 'tasks', id)

        // 禁把 base 写回旧值（V2）
        expect(await baseOf(id)).toBe(SERVER_V3)
        // 不得用过期快照覆盖本地行
        expect((await newLocalTaskRepository().get(id))[0]?.name).toBe('本地当前名')
        expect(result.ok).toBe(false)
    })
})

describe('T641 / A2 旧服务端降级（回执无 serverCurrent）', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    it('AC2/R-E 回执无 serverCurrent ⇒ 显示「将在下次同步后生效」，不得假装成功', async () => {
        const local = await makeTask('我的名字')
        const id = local.id
        // 旧服务端：stale 回执只有 serverUpdatedAt（无 serverCurrent）
        const service = new SyncService(
            mockRequester((url) =>
                url === '/sync/push'
                    ? pushEnvelope([
                          {
                              table: 'tasks',
                              id,
                              outcome: 'stale',
                              serverUpdatedAt: SERVER_V2
                          }
                      ])
                    : pullEnvelope()
            )
        )
        await service.pushAll()
        expect(await loadConflictJournal(USER_ID)).toHaveLength(1)

        const result = await resolveConflictKeepServer(USER_ID, 'tasks', id)

        // 两态之一：不得 ok:true 假装已生效
        expect(result.ok).toBe(false)
        expect(
            isPendingNextSync(result),
            'A2 旧服务端降级需返回 pendingNextSync: true（PM 冻结形状）'
        ).toBe(true)
        // 未写回本地（本地行仍是我的修改）
        expect((await newLocalTaskRepository().get(id))[0]?.name).toBe('我的名字')
        // 条目保留（下次同步拿到 serverCurrent 后可完成）
        expect(await loadConflictJournal(USER_ID)).toHaveLength(1)
    })
})