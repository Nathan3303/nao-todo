// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import {
    CreateTaskCheckItemValueObject,
    CreateTaskCommentValueObject,
    CreateTaskValueObject,
    UpdateTaskCheckItemValueObject,
    UpdateTaskCommentValueObject,
    UpdateTaskValueObject
} from '@nao-todo/domain-task'
import { CreateProjectValueObject, UpdateProjectValueObject } from '@nao-todo/domain-project'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { newLocalTaskCheckItemRepository } from '../../persistence-local/repos/task-check-item-repo-impl'
import { newLocalTaskCommentRepository } from '../../persistence-local/repos/task-comment-repo-impl'
import { newLocalProjectRepository } from '../../persistence-local/repos/project-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import { loadConflictJournal } from '../conflict-journal'
import { getServerTimeOffset } from '../sync-config'
import { syncStatus } from '../sync-status'
import { syncTracker } from '../sync-tracker'
import { SyncService } from '../sync-service'

/**
 * T326 —— 同步冲突客户端侧修复（A / B① / B③ / B② 消费端 + AC-T325-6 skip 口径）
 *
 * 真源：ADR `docs/adr/2026-09-28-sync-conflict-timestamp-basis.md`（`T325`）
 * 派单：`T326`（rd-fe）；服务端半边（派生行回执）由 `T327`。
 *
 * 覆盖：
 * - `AC-T325-3`（RC-3）：pull 「本地胜」⇒ base rebase 到 remoteTs，随后 push 携带新 base；
 * - `AC-T325-7`（RC-5）：写库 + 入队同事务（入队失败整体回滚）· pull 在窗口到达不得静默覆盖（子对象路径）；
 * - `AC-T325-8`（RC-5 ③′）：推送在飞、同 ms 新写 ⇒ 队列项不被误删（revision 守卫）；
 * - `AC-T325-2`（RC-2）：校准生效后连续两次编辑 ⇒ 冲突 +0（伪 `noop` 消除）；
 * - `B②`（RC-1 客户端半边）：消费 `derivedUpdates`（缺省 ⇒ no-op）；
 * - `AC-T325-6`：OCC 能力门 + `AC-T325-5/R-A` E2E（依赖 `T327` 字段 ⇒ 显式 skip，不留假红）。
 */

const USER_ID = 't326-user'
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

/**
 * AC-T325-6 能力门：服务端是否已部署 OCC（`baseUpdatedAt` 命中/不匹配语义）。
 * 单测以 mock 服务端提供 OCC ⇒ `true`；接真实服务端时按部署自检结果置 `false`
 * ⇒ 依赖 `stale` 的断言 `skip` 而非假红。
 */
const SERVER_OCC_AVAILABLE = true

/**
 * 能力门：服务端是否回传派生行版本 `data.derivedUpdates[]`（`T327` / nao-todo-server `5cb30c5`）。
 * 单测以 mock 服务端提供该字段 ⇒ `true`（`AC-T325-5` 转正红→绿）；接真实**旧**服务端时置 `false`
 * ⇒ E2E `skip`（不假红）。
 */
const SERVER_DERIVED_UPDATES_AVAILABLE = true

/** 远程任务 payload（字段与 `taskRes2TaskEntity` 契约一致） */
const remoteTask = (id: string, updatedAt: string, name: string): RawRecord => ({
    id,
    createdAt: '2029-01-01T00:00:00.000Z',
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

/** 远程检查项 payload（字段与 `taskCheckItemRes2Entity` 契约一致） */
const remoteCheckItem = (
    id: string,
    taskId: string,
    updatedAt: string,
    name: string
): RawRecord => ({
    id,
    createdAt: '2029-01-01T00:00:00.000Z',
    updatedAt,
    deletedAt: null,
    taskId,
    name,
    isDone: false,
    sortId: 1
})

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

/** 真实服务端 push 响应体：`body.data = { results, serverTime, ...(additive) }` */
const pushEnvelope = (results: unknown[], extra: RawRecord = {}, serverTime = Date.now()) => ({
    code: 90010,
    message: 'ok',
    data: { results, serverTime: String(serverTime), ...extra }
})

const taskVO = (name: string, parentTaskId: string | null = null): CreateTaskValueObject =>
    new CreateTaskValueObject(
        null,
        parentTaskId,
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
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
    syncStatus.setConflictCount(0)
}

/** 本地 per-row base（缺失 ⇒ undefined） */
const baseOf = async (id: string): Promise<unknown> =>
    (await localDatabase.tasks.get(id))?.syncedServerUpdatedAt

describe('T326', () => {
    beforeEach(async () => {
        await resetLocalState()
    })

    describe('AC-T325-3（B① / RC-3）pull 本地胜 rebase base', () => {
        it('本地胜 ⇒ base 收敛到 remoteTs；随后 push 携带新 base（回执 applied）', async () => {
            const repo = newLocalTaskRepository()
            const [task, err] = await repo.create(taskVO('本地任务'))
            expect(err).toBeNull()
            const id = (task as { id: string }).id
            // 队列项 localUpdatedAt 置于远期 ⇒ pull 判「本地胜」
            const key = `${USER_ID}:tasks:${id}`
            const queued = await localDatabase.syncQueue.get(key)
            await localDatabase.syncQueue.put({
                ...queued!,
                localUpdatedAt: '2030-01-01T00:00:00.000Z'
            })

            const remoteUpdatedAt = '2029-01-01T00:00:00.000Z'
            const pushBodies: RawRecord[] = []
            const service = new SyncService(
                mockRequester((url, body) => {
                    if (url === '/sync/pull') {
                        return pullEnvelope({
                            tasks: {
                                ...EMPTY_TABLE,
                                items: [remoteTask(id, remoteUpdatedAt, '远端名')]
                            }
                        })
                    }
                    pushBodies.push(body as RawRecord)
                    return pushEnvelope([
                        {
                            table: 'tasks',
                            id,
                            outcome: 'applied',
                            serverUpdatedAt: '2030-06-01T00:00:00.000Z'
                        }
                    ])
                })
            )

            await service.pullAll()
            // 改前必红：本地胜分支不写 base ⇒ undefined
            expect(await baseOf(id)).toBe(remoteUpdatedAt)

            await service.pushAll()
            const sent = (pushBodies.at(-1) as { tasks?: RawRecord[] } | undefined)?.tasks ?? []
            // base 命中（与 remoteTs 一致）⇒ 服务端可 OCC 命中
            expect(sent[0]?.baseUpdatedAt).toBe(remoteUpdatedAt)
        })
    })

    describe('AC-T325-7（B③ / RC-5）写库与入队同事务', () => {
        const rejectOnce = () => {
            const spy = vi
                .spyOn(syncTracker, 'markDirty')
                .mockRejectedValueOnce(new Error('queue-unavailable'))
            return spy
        }

        it('任务 update：入队失败 ⇒ 业务写回滚（不得留下未入队的本地写）', async () => {
            const repo = newLocalTaskRepository()
            const [task] = await repo.create(taskVO('原名'))
            const id = (task as { id: string }).id
            const spy = rejectOnce()
            const vo = new UpdateTaskValueObject(id)
            vo.name = '不应落库'
            const err = await repo.update(id, vo)
            spy.mockRestore()
            expect(err).not.toBeNull()
            const [after] = await repo.get(id)
            expect((after as { name: string } | null)?.name).toBe('原名')
        })

        it('检查项 update：入队失败 ⇒ 回滚（子对象写路径）', async () => {
            const taskRepo = newLocalTaskRepository()
            const [parent] = await taskRepo.create(taskVO('父任务'))
            const parentId = (parent as { id: string }).id
            const repo = newLocalTaskCheckItemRepository()
            const [item] = await repo.create(
                new CreateTaskCheckItemValueObject(parentId, '原名', false, false)
            )
            const id = (item as { id: string }).id
            const spy = rejectOnce()
            const vo = new UpdateTaskCheckItemValueObject(id)
            vo.name = '不应落库'
            const err = await repo.update(id, vo)
            spy.mockRestore()
            expect(err).not.toBeNull()
            const [after] = await repo.get(id)
            expect((after as { name: string } | null)?.name).toBe('原名')
        })

        it('评论 update：入队失败 ⇒ 回滚', async () => {
            const taskRepo = newLocalTaskRepository()
            const [parent] = await taskRepo.create(taskVO('父任务'))
            const parentId = (parent as { id: string }).id
            const repo = newLocalTaskCommentRepository()
            const [comment] = await repo.create(
                new CreateTaskCommentValueObject(parentId, '原评论', [], false)
            )
            const id = (comment as { id: string }).id
            const spy = rejectOnce()
            const vo = new UpdateTaskCommentValueObject(id)
            vo.content = '不应落库'
            const err = await repo.update(vo)
            spy.mockRestore()
            expect(err).not.toBeNull()
            const [after] = await repo.get(id)
            expect((after as { content: string } | null)?.content).toBe('原评论')
        })

        it('清单 update：入队失败 ⇒ 回滚', async () => {
            const repo = newLocalProjectRepository()
            const [project] = await repo.create(new CreateProjectValueObject('原清单', 'more2', ''))
            const id = (project as { id: string }).id
            const spy = rejectOnce()
            const vo = new UpdateProjectValueObject(id)
            vo.name = '不应落库'
            const err = await repo.update(vo)
            spy.mockRestore()
            expect(err).not.toBeNull()
            const [after] = await repo.get(id)
            expect((after as { name: string } | null)?.name).toBe('原清单')
        })

        it('检查项 create：入队失败 ⇒ 不落库（同事务）', async () => {
            const taskRepo = newLocalTaskRepository()
            const [parent] = await taskRepo.create(taskVO('父任务'))
            const parentId = (parent as { id: string }).id
            const before = await localDatabase.taskCheckItems.count()
            const spy = rejectOnce()
            const repo = newLocalTaskCheckItemRepository()
            const [, err] = await repo.create(
                new CreateTaskCheckItemValueObject(parentId, '不应落库', false, false)
            )
            spy.mockRestore()
            expect(err).not.toBeNull()
            expect(await localDatabase.taskCheckItems.count()).toBe(before)
        })

        it('pull 在「写库→入队」窗口到达 ⇒ 不得无 journal 静默覆盖（检查项）', async () => {
            const taskRepo = newLocalTaskRepository()
            const [parent] = await taskRepo.create(taskVO('父任务'))
            const parentId = (parent as { id: string }).id
            const repo = newLocalTaskCheckItemRepository()
            const [item] = await repo.create(
                new CreateTaskCheckItemValueObject(parentId, '原检查项', false, false)
            )
            const id = (item as { id: string }).id
            // 清队列：模拟「已同步、无待推」的行，落进 pull 的无队列分支
            await localDatabase.syncQueue.clear()

            const localName = '本地新名'
            const pushBodies: RawRecord[] = []
            let injected = false
            const realGet = localDatabase.syncQueue.get.bind(localDatabase.syncQueue)
            const spy = vi.spyOn(localDatabase.syncQueue, 'get').mockImplementation((async (
                key: string
            ) => {
                // 先返回「空队列」结果（pull 事务外首读），再注入一次本地写 ⇒
                // 复现「pull 已知无队列 → 本地写落库并入队 → pull 写行」的 TOCTOU 窗口
                const result = await realGet(key)
                if (!injected && String(key).includes(':taskCheckItems:')) {
                    injected = true
                    const vo = new UpdateTaskCheckItemValueObject(id)
                    vo.name = localName
                    await repo.update(id, vo)
                }
                return result
            }) as never)

            const service = new SyncService(
                mockRequester((url, body) => {
                    if (url === '/sync/pull') {
                        return pullEnvelope({
                            taskCheckItems: {
                                ...EMPTY_TABLE,
                                items: [
                                    remoteCheckItem(
                                        id,
                                        parentId,
                                        '2030-01-01T00:00:00.000Z',
                                        '远端名'
                                    )
                                ]
                            }
                        })
                    }
                    pushBodies.push(body as RawRecord)
                    return pushEnvelope([])
                })
            )

            await service.pullAll()
            spy.mockRestore()

            const [after] = await repo.get(id)
            const journal = await loadConflictJournal(USER_ID)
            const keptLocal = (after as { name: string } | null)?.name === localName
            const hasSnapshot = journal.some((e) => e.entityId === id && e.kind === 'remote-wins')
            // 改前必红：无事务 ⇒ 行被远端覆盖且无 journal（静默丢写）
            expect(keptLocal || hasSnapshot).toBe(true)
        })
    })

    describe('AC-T325-8（B③ ③′）推送在飞同 ms 新写守卫', () => {
        it('推送在飞、同 ms 新写 ⇒ 队列项不被误删（下轮重推）', async () => {
            const repo = newLocalTaskRepository()
            const [task] = await repo.create(taskVO('原内容'))
            const id = (task as { id: string }).id
            const key = `${USER_ID}:tasks:${id}`
            const before = await localDatabase.syncQueue.get(key)
            const frozenMs = Date.parse(before!.localUpdatedAt)
            // 冻结 Date.now：第二次编辑的 localUpdatedAt 与快照**同毫秒**
            const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(frozenMs)

            // 推送在飞：在 post 周期内注入一次本地新写（同 ms 时间戳）
            const service = new SyncService({
                post: async (url: string) => {
                    if (url === '/sync/push') {
                        const vo = new UpdateTaskValueObject(id)
                        vo.name = '新内容'
                        await repo.update(id, vo)
                        return {
                            data: pushEnvelope([
                                {
                                    table: 'tasks',
                                    id,
                                    outcome: 'applied',
                                    serverUpdatedAt: '2031-01-01T00:00:00.000Z'
                                }
                            ])
                        }
                    }
                    return { data: pullEnvelope() }
                },
                get: async () => ({ data: {} }),
                put: async () => ({ data: {} }),
                delete: async () => ({ data: {} })
            } as unknown as Requester)

            await service.pushAll()
            nowSpy.mockRestore()

            // 改前必红：`localUpdatedAt === snapshot` ⇒ 误删队列项
            expect(await syncTracker.countDirty()).toBe(1)
            const after = await localDatabase.syncQueue.get(key)
            expect(after).toBeDefined()
            expect(after!.localUpdatedAt).toBe(before!.localUpdatedAt)
        })
    })

    describe('AC-T325-2（A / RC-2）校准生效后无伪冲突', () => {
        it('连续两次编辑（第二次紧跟前一次 push）⇒ 冲突 +0', async () => {
            // 服务端时钟领先 60s；mock 为**未部署 OCC** 的 LWW 判定（`baseUpdatedAt` 被忽略）
            const SKEW_MS = 60_000
            const serverTasks = new Map<string, { updatedAt: string }>()
            const serverNowIso = (): string => new Date(Date.now() + SKEW_MS).toISOString()
            const service = new SyncService(
                mockRequester((url, body) => {
                    if (url === '/sync/push') {
                        const results: unknown[] = []
                        for (const item of (body as { tasks?: RawRecord[] }).tasks ?? []) {
                            const id = String(item.id)
                            const cur = serverTasks.get(id)
                            if (
                                cur &&
                                Date.parse(cur.updatedAt) > Date.parse(String(item.updatedAt))
                            ) {
                                results.push({
                                    table: 'tasks',
                                    id,
                                    outcome: 'noop',
                                    serverUpdatedAt: cur.updatedAt
                                })
                            } else {
                                const ts = serverNowIso()
                                serverTasks.set(id, { updatedAt: ts })
                                results.push({
                                    table: 'tasks',
                                    id,
                                    outcome: 'applied',
                                    serverUpdatedAt: ts
                                })
                            }
                        }
                        return pushEnvelope(results, {}, Date.now() + SKEW_MS)
                    }
                    return pullEnvelope({}, Date.now() + SKEW_MS)
                })
            )
            const repo = newLocalTaskRepository()
            const [task, err] = await repo.create(taskVO('第一次'))
            expect(err).toBeNull()
            const id = (task as { id: string }).id

            await service.pushAll()
            // 校准必须已生效（接线级：serverTime 位于 body.data.serverTime）
            expect(getServerTimeOffset()).toBeGreaterThan(SKEW_MS / 2)

            const vo = new UpdateTaskValueObject(id)
            vo.name = '第二次'
            expect(await repo.update(id, vo)).toBeNull()
            syncStatus.setConflictCount(0)
            await service.pushAll()
            // 改前必红：校准失效 ⇒ 第二次编辑时间戳落后服务端落库戳 ⇒ noop ⇒ 冲突 +1
            expect(syncStatus.get().conflictCount).toBe(0)
        })
    })

    describe('B②（RC-1 客户端半边）派生行版本回执消费', () => {
        it('回执含 derivedUpdates ⇒ 父任务 base 收敛到派生行 updatedAt', async () => {
            const repo = newLocalTaskRepository()
            const [task] = await repo.create(taskVO('父任务'))
            const id = (task as { id: string }).id
            const derivedTs = '2031-06-01T00:00:00.000Z'
            const service = new SyncService(
                mockRequester((url) => {
                    if (url === '/sync/push') {
                        return pushEnvelope(
                            [
                                {
                                    table: 'tasks',
                                    id,
                                    outcome: 'applied',
                                    serverUpdatedAt: '2031-02-01T00:00:00.000Z'
                                }
                            ],
                            { derivedUpdates: [{ table: 'tasks', id, updatedAt: derivedTs }] }
                        )
                    }
                    return pullEnvelope()
                })
            )
            await service.pushAll()
            expect(await baseOf(id)).toBe(derivedTs)
        })

        it('回执缺省 derivedUpdates ⇒ 完全 no-op（旧服务端行为不变）', async () => {
            const repo = newLocalTaskRepository()
            const [task] = await repo.create(taskVO('父任务'))
            const id = (task as { id: string }).id
            const appliedTs = '2031-02-01T00:00:00.000Z'
            const service = new SyncService(
                mockRequester((url) => {
                    if (url === '/sync/push') {
                        return pushEnvelope([
                            { table: 'tasks', id, outcome: 'applied', serverUpdatedAt: appliedTs }
                        ])
                    }
                    return pullEnvelope()
                })
            )
            await service.pushAll()
            expect(await baseOf(id)).toBe(appliedTs)
        })

        it('未知表 / 空字段的 derivedUpdates ⇒ 忽略', async () => {
            const repo = newLocalTaskRepository()
            const [task] = await repo.create(taskVO('父任务'))
            const id = (task as { id: string }).id
            const appliedTs = '2031-02-01T00:00:00.000Z'
            const service = new SyncService(
                mockRequester((url) => {
                    if (url === '/sync/push') {
                        return pushEnvelope(
                            [
                                {
                                    table: 'tasks',
                                    id,
                                    outcome: 'applied',
                                    serverUpdatedAt: appliedTs
                                }
                            ],
                            {
                                derivedUpdates: [
                                    {
                                        table: 'unknownTable',
                                        id,
                                        updatedAt: '2031-09-01T00:00:00.000Z'
                                    },
                                    {
                                        table: 'tasks',
                                        id: '',
                                        updatedAt: '2031-09-01T00:00:00.000Z'
                                    }
                                ]
                            }
                        )
                    }
                    return pullEnvelope()
                })
            )
            await service.pushAll()
            expect(await baseOf(id)).toBe(appliedTs)
        })

        it('脏行也收敛 base（队列项保留 + 业务字段不被改）（PM 裁定 #1）', async () => {
            const repo = newLocalTaskRepository()
            const checkRepo = newLocalTaskCheckItemRepository()
            const [parent] = await repo.create(taskVO('父任务'))
            const parentId = (parent as { id: string }).id
            const derivedTs = '2033-01-01T00:00:00.000Z'
            const service = new SyncService(
                mockRequester((url, body) => {
                    if (url !== '/sync/push') return pullEnvelope()
                    const b = body as { tasks?: RawRecord[]; taskCheckItems?: RawRecord[] }
                    const results: unknown[] = []
                    for (const item of b.tasks ?? []) {
                        results.push({
                            table: 'tasks',
                            id: String(item.id),
                            outcome: 'applied',
                            serverUpdatedAt: '2033-01-01T00:00:00.000Z'
                        })
                    }
                    for (const item of b.taskCheckItems ?? []) {
                        results.push({
                            table: 'taskCheckItems',
                            id: String(item.id),
                            outcome: 'applied',
                            serverUpdatedAt: '2033-01-02T00:00:00.000Z'
                        })
                    }
                    // 仅在子实体批回传派生写（模拟服务端只在派生时回传父行版本）
                    return (b.taskCheckItems?.length ?? 0) > 0
                        ? pushEnvelope(results, {
                              derivedUpdates: [
                                  { table: 'tasks', id: parentId, updatedAt: derivedTs }
                              ]
                          })
                        : pushEnvelope(results)
                })
            )
            // 先推一次父任务 ⇒ 落 base
            await service.pushAll()
            // 本地改父任务 ⇒ 脏
            const vo = new UpdateTaskValueObject(parentId)
            vo.name = '改后'
            expect(await repo.update(parentId, vo)).toBeNull()
            // 父任务队列项置退避未到期 ⇒ 本批只推子实体，父任务保持脏
            const key = `${USER_ID}:tasks:${parentId}`
            const queued = await localDatabase.syncQueue.get(key)
            await localDatabase.syncQueue.put({
                ...queued!,
                nextAttemptAt: new Date(Date.now() + 3_600_000).toISOString()
            })
            await checkRepo.create(
                new CreateTaskCheckItemValueObject(parentId, '检查项', false, false)
            )

            await service.pushAll()
            // 脏行 base 同样收敛到派生行版本
            expect(await baseOf(parentId)).toBe(derivedTs)
            // 队列项保留（本地改动待推）
            expect(await localDatabase.syncQueue.get(key)).toBeDefined()
            // 业务字段未被覆盖
            const [after] = await repo.get(parentId)
            expect((after as { name: string } | null)?.name).toBe('改后')
        })

        it('同批多个派生行（新旧父行）⇒ 全部收敛 base', async () => {
            const repo = newLocalTaskRepository()
            const [a] = await repo.create(taskVO('父 A'))
            const [b] = await repo.create(taskVO('父 B'))
            const idA = (a as { id: string }).id
            const idB = (b as { id: string }).id
            const tsA = '2034-01-01T00:00:00.000Z'
            const tsB = '2034-02-01T00:00:00.000Z'
            const service = new SyncService(
                mockRequester((url, body) => {
                    if (url !== '/sync/push') return pullEnvelope()
                    const results = ((body as { tasks?: RawRecord[] }).tasks ?? []).map((item) => ({
                        table: 'tasks',
                        id: String(item.id),
                        outcome: 'applied',
                        serverUpdatedAt: '2034-03-01T00:00:00.000Z'
                    }))
                    return pushEnvelope(results, {
                        derivedUpdates: [
                            { table: 'tasks', id: idA, updatedAt: tsA },
                            { table: 'tasks', id: idB, updatedAt: tsB }
                        ]
                    })
                })
            )
            await service.pushAll()
            expect(await baseOf(idA)).toBe(tsA)
            expect(await baseOf(idB)).toBe(tsB)
        })
    })

    describe('AC-T325-6 OCC 能力门（未部署 OCC ⇒ skip 而非假红）', () => {
        it.skipIf(!SERVER_OCC_AVAILABLE)(
            'base 不匹配 ⇒ 回执 stale：客户端登记冲突并写回库中版本',
            async () => {
                const repo = newLocalTaskRepository()
                const [task] = await repo.create(taskVO('任务'))
                const id = (task as { id: string }).id
                await localDatabase.tasks.update(id, {
                    syncedServerUpdatedAt: '2031-01-01T00:00:00.000Z'
                })
                const serverVersion = '2031-05-01T00:00:00.000Z'
                const service = new SyncService(
                    mockRequester((url) => {
                        if (url === '/sync/push') {
                            return pushEnvelope([
                                {
                                    table: 'tasks',
                                    id,
                                    outcome: 'stale',
                                    serverUpdatedAt: serverVersion
                                }
                            ])
                        }
                        return pullEnvelope()
                    })
                )
                await service.pushAll()
                expect(await baseOf(id)).toBe(serverVersion)
                const journal = await loadConflictJournal(USER_ID)
                expect(journal.some((e) => e.entityId === id && e.kind === 'stale')).toBe(true)
            }
        )
    })

    describe('AC-T325-5 / R-A E2E（用户序列 + T327 derivedUpdates 协议）', () => {
        /**
         * 用户确认序列：**改检查项名 → 移动检查项（同任务内改 `sortId`）→ 建子任务 → 改子任务属性 → 再推父任务**。
         * mock 服务端按 `T327` 冻结协议回传 `derivedUpdates`（父任务库中最终版本）⇒ 客户端 base 随派生写收敛
         * ⇒ 再推父任务 `applied` ⇒ 冲突 +0。
         * 改前（B② 未消费 `derivedUpdates` 时）必红：base 静默过期 ⇒ 推父任务 `stale` ⇒ 冲突 +1。
         * 能力门：服务端无 `derivedUpdates`（旧部署）⇒ `skip`，不假红。
         */
        it.skipIf(!SERVER_DERIVED_UPDATES_AVAILABLE)(
            '用户序列触发派生写 ⇒ 冲突 +0（消费 T327 derivedUpdates）',
            async () => {
                const repo = newLocalTaskRepository()
                const checkRepo = newLocalTaskCheckItemRepository()
                const [parent] = await repo.create(taskVO('父任务'))
                const parentId = (parent as { id: string }).id
                const serverTasks = new Map<string, string>()
                let clock = Date.parse('2032-01-01T00:00:00.000Z')
                const tick = (): string => {
                    clock += 7
                    return new Date(clock).toISOString()
                }
                /** 服务端计数联动（`CountUpdater`）：推进父任务 `updated_at` 并作为派生行版本回传 */
                const deriveParent = (): string => {
                    const ts = tick()
                    serverTasks.set(parentId, ts)
                    return ts
                }

                const service = new SyncService(
                    mockRequester((url, body) => {
                        if (url !== '/sync/push') return pullEnvelope()
                        const b = body as { tasks?: RawRecord[]; taskCheckItems?: RawRecord[] }
                        const results: unknown[] = []
                        const derivedUpdates: RawRecord[] = []
                        for (const item of b.tasks ?? []) {
                            const id = String(item.id)
                            const cur = serverTasks.get(id)
                            const base = item.baseUpdatedAt
                            if (cur && typeof base === 'string' && base !== cur) {
                                results.push({
                                    table: 'tasks',
                                    id,
                                    outcome: 'stale',
                                    serverUpdatedAt: cur
                                })
                            } else {
                                const ts = tick()
                                serverTasks.set(id, ts)
                                results.push({
                                    table: 'tasks',
                                    id,
                                    outcome: 'applied',
                                    serverUpdatedAt: ts
                                })
                                // 子任务创建/更新 ⇒ 派生推进父任务
                                if (item.parentTaskId) {
                                    derivedUpdates.push({
                                        table: 'tasks',
                                        id: parentId,
                                        updatedAt: deriveParent()
                                    })
                                }
                            }
                        }
                        for (const item of b.taskCheckItems ?? []) {
                            results.push({
                                table: 'taskCheckItems',
                                id: String(item.id),
                                outcome: 'applied',
                                serverUpdatedAt: tick()
                            })
                            // 检查项创建/更新 ⇒ 派生推进父任务
                            derivedUpdates.push({
                                table: 'tasks',
                                id: parentId,
                                updatedAt: deriveParent()
                            })
                        }
                        return derivedUpdates.length > 0
                            ? pushEnvelope(results, { derivedUpdates })
                            : pushEnvelope(results)
                    })
                )

                // 1) 父任务首推：落 base
                await service.pushAll()
                // 2) 建检查项（服务端派生写父任务）
                const [checkItem] = await checkRepo.create(
                    new CreateTaskCheckItemValueObject(parentId, '检查项', false, false)
                )
                const checkItemId = (checkItem as { id: string }).id
                await service.pushAll()
                // 3) 改检查项名
                const renameItem = new UpdateTaskCheckItemValueObject(checkItemId)
                renameItem.name = '检查项改名'
                await checkRepo.update(checkItemId, renameItem)
                await service.pushAll()
                // 4) 移动检查项（同任务内改 sortId；客户端无跨任务移动语义）
                const moveItem = new UpdateTaskCheckItemValueObject(checkItemId)
                moveItem.sortId = 5
                await checkRepo.update(checkItemId, moveItem)
                await service.pushAll()
                // 5) 建子任务
                const [subtask] = await repo.create(taskVO('子任务', parentId))
                const subtaskId = (subtask as { id: string }).id
                await service.pushAll()
                // 6) 改子任务属性
                const renameSub = new UpdateTaskValueObject(subtaskId)
                renameSub.name = '子任务改名'
                await repo.update(subtaskId, renameSub)
                await service.pushAll()
                // 7) 再推父任务
                const renameParent = new UpdateTaskValueObject(parentId)
                renameParent.name = '父任务改名'
                await repo.update(parentId, renameParent)
                syncStatus.setConflictCount(0)
                await service.pushAll()

                expect(syncStatus.get().conflictCount).toBe(0)
                // 服务端最终版本 = 最后一次改名（applied 覆盖）
                expect(serverTasks.get(parentId)).toBeDefined()
            }
        )
    })
})