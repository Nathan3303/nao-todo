import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CreateProjectValueObject } from '@nao-todo/domain-project'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import type { Requester } from '@nao-todo/shared'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import { LocalProjectRepoImpl } from '../../persistence-local/repos/project-repo-impl'
import { LocalTaskRepoImpl } from '../../persistence-local/repos/task-repo-impl'
import { SyncService } from '../sync-service'
import { syncTracker } from '../sync-tracker'

/**
 * T187 · R-5 受控探针（受控往返，不改实现）
 *
 * 命题（终验报告 §7④ 静态推断）：本批单任务脱归档 ⇒ `projectId='inbox'`，经 push/pull
 * 往返后被服务端归一为 `userId` ⇒ 本地按字面 `'inbox'` 过滤的收集箱视图**不再命中**。
 *
 * 本探针把该推断拆成两段独立证据：
 *  S1（**实际同步链路**，服务端 HEAD `1c29a69` 语义）：
 *     `CreateTaskReqToValueObject` 对 `'inbox'` **报错**（`ParseID('inbox')` 失败）——
 *     sync push 走 `CreateTask`（`interfaces/controllers/sync.go`）⇒ 该行 push outcome=error，
 *     归一**从未发生**；本地队列项保留，pull 因 LWW（本地脏且更新）不覆盖 ⇒ 任务**不消失**。
 *  S2（**counterfactual：归一成立**，即服务端 update 路径语义 / 未来修复后）：
 *     若 `'inbox'` 被归一为 `userId` 且回传，本地 `taskRecordToEntity` 原样落库 `userId`
 *     ⇒ 收集箱字面过滤失效 ⇒ 任务**从收集箱消失**（客户侧半程缺口成立）。
 *
 * 结论口径见 `docs/qa/2026-09-25-r5-inbox-roundtrip-probe.md`。
 * 均为**绿**：S1 断言「当前真实链路不消失」；S2 断言「归一旦回传则消失」。
 */

const USER = '1001' // 与服务器 userId 同为十进制字符串（FormatID 语义一致）
const ARCHIVED_AT = '2026-09-01T00:00:00.000Z' // 远程/本地归档态（早于本地 updatedAt）
const REMOTE_UPDATED_AT = '2026-09-01T00:00:00.000Z'
const INBOX_QUERY = 'projectId=inbox'

const clearAll = async (): Promise<void> => {
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
        await (
            localDatabase[table as keyof typeof localDatabase] as { clear: () => Promise<void> }
        ).clear()
    }
}

const setup = async (): Promise<void> => {
    await clearAll()
    cryptoService.lock()
    localSession.setCurrentUserId(USER)
    await cryptoService.setup(USER, 'test-password')
}

const mockRequester = (handler: (url: string, body: unknown) => unknown): Requester =>
    ({
        post: async (url: string, body: unknown) => ({ data: handler(url, body) }),
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    }) as unknown as Requester

type PushBody = { tasks?: { id: string; projectId: string; archivedAt: unknown }[] }

/** 建「归档清单 + 其下已归档任务」并清空同步队列（模拟两端已同步的基线态） */
const seedArchivedTask = async (): Promise<{ taskId: string; projectId: string }> => {
    const projectRepo = new LocalProjectRepoImpl()
    const taskRepo = new LocalTaskRepoImpl()

    const [project, projectErr] = await projectRepo.create(
        new CreateProjectValueObject('归档清单', 'more2', '')
    )
    expect(projectErr).toBeNull()
    expect(await projectRepo.archive(project!.id)).toBeNull()

    const [task, taskErr] = await taskRepo.create(
        new CreateTaskValueObject(
            null,
            null,
            '归档任务',
            '',
            'todo',
            'medium',
            null,
            null,
            project!.id,
            [],
            null,
            'none',
            null,
            []
        )
    )
    expect(taskErr).toBeNull()

    const record = (await localDatabase.tasks.get(task!.id))!
    await localDatabase.tasks.put({ ...record, archivedAt: ARCHIVED_AT, updatedAt: ARCHIVED_AT })
    // 基线：远端已有同 id 行（服务端 project_id = 清单 id 的十进制串）
    await localDatabase.tasks.update(task!.id, { syncedServerUpdatedAt: ARCHIVED_AT })
    // 清空队列（清单 + 任务），只保留后续 `unarchive` 产生的脏项
    await localDatabase.syncQueue.clear()
    return { taskId: task!.id, projectId: project!.id }
}

/** 走「单任务脱归档」，清单仍归档 ⇒ 断言落库为字面 `'inbox'` */
const unarchiveToInbox = async (taskId: string): Promise<void> => {
    const taskRepo = new LocalTaskRepoImpl()
    const [payload, err] = await taskRepo.unarchive(taskId)
    expect(err).toBeNull()
    expect(payload).toEqual({ movedToInbox: true })
    const record = (await localDatabase.tasks.get(taskId))!
    expect(record.projectId).toBe('inbox')
    expect(record.archivedAt).toBeNull()
}

/** 收集箱本地过滤（对齐 `LocalTaskRepoImpl.list` 的字面 `r.projectId === query.projectId`） */
const inboxContains = async (taskId: string): Promise<boolean> => {
    const [result, err] = await new LocalTaskRepoImpl().list(INBOX_QUERY)
    expect(err).toBeNull()
    return (result?.taskEntities ?? []).some((entity) => entity.id === taskId)
}

describe('T187 · R-5 收集箱往返探针', () => {
    beforeEach(async () => {
        await setup()
    })

    it("S1 实际链路：push 发送 'inbox' ⇒ 服务端 create 路径拒绝 ⇒ 本地不消失", async () => {
        const { taskId, projectId } = await seedArchivedTask()
        await unarchiveToInbox(taskId)

        const captured: {
            pushedBody: PushBody | null
            pushResults: { table: string; id: string; outcome?: string; error?: string }[]
        } = { pushedBody: null, pushResults: [] }
        const service = new SyncService(
            mockRequester((url, body) => {
                if (url === '/sync/pull') {
                    // 服务端行未被改动：仍是原清单 projectId + 归档态
                    const remoteTask = {
                        id: taskId,
                        createdAt: ARCHIVED_AT,
                        updatedAt: REMOTE_UPDATED_AT,
                        deletedAt: null,
                        parentTaskId: '',
                        name: '归档任务',
                        description: '',
                        state: 'todo',
                        priority: 'medium',
                        startAt: '',
                        endAt: '',
                        tags: [],
                        projectId, // FormatID(清单 id) —— 非 'inbox'
                        archivedAt: ARCHIVED_AT,
                        starMarkAt: null,
                        givenUpAt: null,
                        remindAt: null,
                        remindRepeat: 'none',
                        remindTime: null,
                        remindWeekdays: []
                    }
                    return {
                        data: {
                            data: {
                                tasks: { items: [remoteTask], nextCursor: null },
                                projects: { items: [], nextCursor: null },
                                tags: { items: [], nextCursor: null },
                                taskCheckItems: { items: [], nextCursor: null },
                                taskComments: { items: [], nextCursor: null },
                                pomodoros: { items: [], nextCursor: null },
                                pomodoroRecords: { items: [], nextCursor: null }
                            }
                        },
                        serverTime: Date.now()
                    }
                }
                // /sync/push：复现 Go `CreateTaskReqToValueObject`（create 路径）——
                // projectId 非空 ⇒ idutil.ParseID ⇒ 'inbox' 失败 ⇒ 该行 error（不归一、不落库）
                captured.pushedBody = body as PushBody
                const rows = captured.pushedBody.tasks ?? []
                const results = rows.map((row) => ({
                    table: 'tasks',
                    id: row.id,
                    error: 'strconv.ParseInt: parsing "inbox": invalid syntax',
                    outcome: Number.isFinite(Number(row.projectId)) ? 'applied' : 'error'
                }))
                captured.pushResults = results
                return { data: { results }, serverTime: Date.now() }
            })
        )

        await service.pushAll()
        // 证据 1：线上载荷确为字面 'inbox'
        expect(captured.pushedBody?.tasks?.[0]?.projectId).toBe('inbox')
        // 证据 2：服务端 create 路径判定为 error（未归一、未落库）
        expect(captured.pushResults.find((r) => r.id === taskId)?.outcome).toBe('error')
        // 证据 3：服务端拒绝 ⇒ 队列项保留（本地改动未被确认）
        const dirty = await syncTracker.listDirty()
        expect(dirty.some((item) => item.entityId === taskId)).toBe(true)

        await service.pullAll()
        // 证据 3：pull 因本地脏且更新（LWW）不覆盖 ⇒ 本地仍为 'inbox'
        const record = (await localDatabase.tasks.get(taskId))!
        expect(record.projectId).toBe('inbox')
        // 结论：任务仍在收集箱（未消失）
        expect(await inboxContains(taskId)).toBe(true)
    })

    it('S2 归一旦回传：服务端把 inbox 归一为 userId 并回传 ⇒ 收集箱字面过滤不再命中', async () => {
        const { taskId } = await seedArchivedTask()
        await unarchiveToInbox(taskId)

        const appliedAt = new Date(Date.now() + 60_000).toISOString() // 服务端版本更新

        const service = new SyncService(
            mockRequester((url, body) => {
                if (url === '/sync/push') {
                    const rows = ((body as PushBody).tasks ?? []).map((row) => ({
                        table: 'tasks',
                        id: row.id,
                        outcome: 'applied',
                        serverUpdatedAt: appliedAt
                    }))
                    return { data: { results: rows }, serverTime: Date.now() }
                }
                // /sync/pull：服务端携带归一后的 userId（`FormatID(ProjectID)` = "1001"）
                const remoteTask = {
                    id: taskId,
                    createdAt: appliedAt,
                    updatedAt: appliedAt,
                    deletedAt: null,
                    parentTaskId: '',
                    name: '归档任务',
                    description: '',
                    state: 'todo',
                    priority: 'medium',
                    startAt: '',
                    endAt: '',
                    tags: [],
                    projectId: USER, // 服务端归一结果（隐式桶）
                    archivedAt: null,
                    starMarkAt: null,
                    givenUpAt: null,
                    remindAt: null,
                    remindRepeat: 'none',
                    remindTime: null,
                    remindWeekdays: []
                }
                return {
                    data: {
                        data: {
                            tasks: { items: [remoteTask], nextCursor: null },
                            projects: { items: [], nextCursor: null },
                            tags: { items: [], nextCursor: null },
                            taskCheckItems: { items: [], nextCursor: null },
                            taskComments: { items: [], nextCursor: null },
                            pomodoros: { items: [], nextCursor: null },
                            pomodoroRecords: { items: [], nextCursor: null }
                        }
                    },
                    serverTime: Date.now()
                }
            })
        )

        await service.pushAll()
        await service.pullAll()

        // 证据：pull 原样落库 `userId`（`persistence-local/converters/task.ts` 无 'inbox' 反归一）
        const record = (await localDatabase.tasks.get(taskId))!
        expect(record.projectId).toBe(USER)
        // 结论：「归一旦回传」成立时，收集箱字面过滤不再命中 ⇒ 任务消失
        expect(await inboxContains(taskId)).toBe(false)
    })
})