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
 * T187 · R-5 受控往返探针
 *
 * 命题（终验报告 §7④ 静态推断）：单任务脱归档 ⇒ `projectId='inbox'`，经 push/pull
 * 往返后被服务端归一为 `userId` ⇒ 本地按字面 `'inbox'` 过滤的收集箱视图**不再命中**。
 *
 * 原始结论（T187，修复前）：② 实测**未消失** —— sync push 走 `CreateTask`（create 路径），
 * 对 `'inbox'` 直接报错（`ParseID('inbox')` 失败）、归一**从未发生**；但该变更**永远同步不到服务端**
 * （队列项业务退避、长期积压），且读侧字面过滤缺口为真（R-5 既有）。
 *
 * **T188（修法 C + B）已闭环该缺陷** ⇒ 本文件断言随之**正向化**（S1/S2 分组语义不变）：
 *  S1（**实际同步链路**）：写侧 `'inbox'` ⇒ 载荷 `''`（服务端 create 归一到 `userId`）⇒ push
 *     `applied` + 队列出队；读侧 pull 回 `userId` ⇒ 落库归一为 `'inbox'` ⇒ 收集箱命中（**往返闭环**）。
 *  S2（**读侧半程 · 正向不变量**；原为 counterfactual）：服务端归一结果（`projectId = userId`）
 *     经 pull 落库 ⇒ 本地**必须**为字面 `'inbox'` ⇒ 收集箱**必须命中**（防读侧归一被静默回退）。
 *
 * 结论口径见 `docs/qa/2026-09-25-r5-inbox-roundtrip-probe.md`（T187 原始结论）与 T188 派单。
 * S1/S2 均为**绿**。
 */

const USER = '1001' // 与服务器 userId 同为十进制字符串（FormatID 语义一致）
const ARCHIVED_AT = '2026-09-01T00:00:00.000Z' // 远程/本地归档态（早于本地 updatedAt）
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

    it("S1 实际链路：脱归档 ⇒ push 载荷 '' ⇒ applied/出队 ⇒ pull 归一回 'inbox' ⇒ 收集箱命中", async () => {
        const { taskId } = await seedArchivedTask()
        await unarchiveToInbox(taskId)

        const appliedAt = new Date(Date.now() + 60_000).toISOString() // 服务端版本更新
        const captured: {
            pushedBody: PushBody | null
            pushResults: { table: string; id: string; outcome?: string; error?: string }[]
        } = { pushedBody: null, pushResults: [] }
        const service = new SyncService(
            mockRequester((url, body) => {
                if (url === '/sync/pull') {
                    // 服务端已按 create 路径把 `''` 归一为 userId（隐式桶）并落库 ⇒ pull 回 userId
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
                        projectId: USER, // FormatID(userId) —— 隐式桶
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
                }
                // /sync/push：复现 Go `CreateTaskReqToValueObject`（create 路径）——
                // projectId `''` ⇒ 归一为 userId ⇒ applied；字面 `'inbox'` ⇒ ParseID 失败 ⇒ error
                captured.pushedBody = body as PushBody
                const rows = (captured.pushedBody.tasks ?? []).map((row) => ({
                    table: 'tasks',
                    id: row.id,
                    ...(row.projectId === 'inbox'
                        ? {
                              outcome: 'error',
                              error: 'strconv.ParseInt: parsing "inbox": invalid syntax'
                          }
                        : { outcome: 'applied', serverUpdatedAt: appliedAt })
                }))
                captured.pushResults = rows
                return { data: { results: rows }, serverTime: Date.now() }
            })
        )

        await service.pushAll()
        // C（写侧）：载荷为 `''`（非字面 'inbox'）⇒ 服务端 create 路径不再 error
        expect(captured.pushedBody?.tasks?.[0]?.projectId).toBe('')
        expect(captured.pushResults.find((r) => r.id === taskId)?.outcome).toBe('applied')
        // 确认 ⇒ 出队（不再业务退避、长期积压）
        const dirty = await syncTracker.listDirty()
        expect(dirty.some((item) => item.entityId === taskId)).toBe(false)

        await service.pullAll()
        // B（读侧）：服务端隐式桶 userId ⇒ 落库归一为字面 'inbox'
        const record = (await localDatabase.tasks.get(taskId))!
        expect(record.projectId).toBe('inbox')
        // 结论：任务仍在收集箱（往返闭环）
        expect(await inboxContains(taskId)).toBe(true)
    })

    it('S2 读侧半程（正向不变量）：服务端归一结果 userId 经 pull 落库 ⇒ 收集箱必须命中', async () => {
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

        // B：pull 落库把隐式桶 userId 归一为字面 'inbox'（不再原样落库 userId）
        const record = (await localDatabase.tasks.get(taskId))!
        expect(record.projectId).toBe('inbox')
        // 正向不变量：收集箱字面过滤**必须命中**（读侧归一被静默回退即转红）
        expect(await inboxContains(taskId)).toBe(true)
    })
})