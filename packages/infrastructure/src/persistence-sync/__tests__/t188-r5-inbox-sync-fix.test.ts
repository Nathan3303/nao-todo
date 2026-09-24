import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CreateProjectValueObject } from '@nao-todo/domain-project'
import { CreateTaskValueObject, UpdateTaskValueObject } from '@nao-todo/domain-task'
import type { Requester } from '@nao-todo/shared'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import { LocalProjectRepoImpl } from '../../persistence-local/repos/project-repo-impl'
import { LocalTaskRepoImpl } from '../../persistence-local/repos/task-repo-impl'
import { SyncService } from '../sync-service'

/**
 * T188 · R-5 同步边界闭环（修法 C 写侧 + B 读侧）回归
 *
 * - **C（写侧）**：`buildTaskPush` 把本地收集箱 `'inbox'` 发送为 `''`（服务端 create 归一为 `userId`）
 *   ⇒ 一处生效，覆盖全部 `'inbox'` 写者。
 * - **B（读侧）**：`putPulledRecord` 把服务端隐式桶（`projectId === userId`）落库归一为 `'inbox'`
 *   ⇒ 本地字面 `'inbox'` 过滤命中。
 *
 * 本文件覆盖 T187 探针之外的面：其它 `'inbox'` 写者（create / update 路径）、
 * C 写侧负向（真清单 id 不得被改写）、B 读侧负向（真清单 id 不得被误归一）。
 * 端到端往返与 `'inbox'` 读侧正向往返见 `t187-r5-inbox-roundtrip.probe.test.ts`。
 */

const USER = '1001' // 与服务器 userId 同为十进制字符串（FormatID 语义一致）
const INBOX_QUERY = 'projectId=inbox'
const FUTURE = '2026-12-01T00:00:00.000Z'

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

type PushRow = { id: string; projectId: string; archivedAt: unknown }
type PushBody = { tasks?: PushRow[] }
type PushResultRow = { table: string; id: string; outcome?: string; error?: string }

/** 复现 Go create 路径语义的 push 端：`''` ⇒ applied；字面 `'inbox'` ⇒ error；其余 ⇒ applied */
const pushCapture = (): {
    service: SyncService
    captured: { body: PushBody | null; results: PushResultRow[] }
} => {
    const captured: { body: PushBody | null; results: PushResultRow[] } = {
        body: null,
        results: []
    }
    const service = new SyncService(
        mockRequester((_url, body) => {
            captured.body = body as PushBody
            const rows = (captured.body.tasks ?? []).map((row) => ({
                table: 'tasks',
                id: row.id,
                ...(row.projectId === 'inbox'
                    ? {
                          outcome: 'error',
                          error: 'strconv.ParseInt: parsing "inbox": invalid syntax'
                      }
                    : { outcome: 'applied', serverUpdatedAt: FUTURE })
            }))
            captured.results = rows
            return { data: { results: rows }, serverTime: Date.now() }
        })
    )
    return { service, captured }
}

/** 完整任务响应行（对齐 `taskRes2TaskEntity` 入参） */
const remoteTask = (id: string, projectId: string) => ({
    id,
    createdAt: FUTURE,
    updatedAt: FUTURE,
    deletedAt: null,
    parentTaskId: '',
    name: '任务',
    description: '',
    state: 'todo',
    priority: 'medium',
    startAt: '',
    endAt: '',
    tags: [],
    projectId,
    archivedAt: null,
    starMarkAt: null,
    givenUpAt: null,
    remindAt: null,
    remindRepeat: 'none',
    remindTime: null,
    remindWeekdays: []
})

const pullOnly = (items: ReturnType<typeof remoteTask>[]): SyncService =>
    new SyncService(
        mockRequester((url) => {
            if (url !== '/sync/pull') return {}
            return {
                data: {
                    data: {
                        tasks: { items, nextCursor: null },
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

const makeCreateVO = (name: string, projectId: string): CreateTaskValueObject =>
    new CreateTaskValueObject(
        null,
        null,
        name,
        '',
        'todo',
        'medium',
        null,
        null,
        projectId,
        [],
        null,
        'none',
        null,
        []
    )

const inboxContains = async (taskId: string): Promise<boolean> => {
    const [result, err] = await new LocalTaskRepoImpl().list(INBOX_QUERY)
    expect(err).toBeNull()
    return (result?.taskEntities ?? []).some((entity) => entity.id === taskId)
}

describe('T188 · R-5 同步边界闭环（C 写侧 / B 读侧）', () => {
    beforeEach(async () => {
        await setup()
    })

    it("C：其它 'inbox' 写者（create / update 路径）⇒ push 载荷均为 '' 且 applied", async () => {
        const taskRepo = new LocalTaskRepoImpl()
        // create 路径（creator 选收集箱）
        const [created, createdErr] = await taskRepo.create(makeCreateVO('收集箱新任务', 'inbox'))
        expect(createdErr).toBeNull()
        // update 路径（任务详情「移动到收集箱」）
        const [moved, movedErr] = await taskRepo.create(makeCreateVO('待移动任务', 'p-1'))
        expect(movedErr).toBeNull()
        const moveVO = new UpdateTaskValueObject(moved!.id)
        moveVO.projectId = 'inbox'
        expect(await taskRepo.update(moved!.id, moveVO)).toBeNull()

        // 本地写入口径仍为字面 'inbox'（数据面单一真源不变）
        expect((await localDatabase.tasks.get(created!.id))!.projectId).toBe('inbox')
        expect((await localDatabase.tasks.get(moved!.id))!.projectId).toBe('inbox')

        const { service, captured } = pushCapture()
        await service.pushAll()

        const pushed = new Map((captured.body?.tasks ?? []).map((row) => [row.id, row]))
        expect(pushed.get(created!.id)?.projectId).toBe('')
        expect(pushed.get(moved!.id)?.projectId).toBe('')
        expect(captured.results.every((row) => row.outcome === 'applied')).toBe(true)
    })

    it("C 负向：真清单 id 原样发送（不得被改写成 ''）", async () => {
        const taskRepo = new LocalTaskRepoImpl()
        const [task, err] = await taskRepo.create(makeCreateVO('真清单任务', 'p-1'))
        expect(err).toBeNull()
        expect((await localDatabase.tasks.get(task!.id))!.projectId).toBe('p-1')

        const { service, captured } = pushCapture()
        await service.pushAll()

        expect(captured.body?.tasks?.[0]?.projectId).toBe('p-1')
    })

    it("B 收益：既有无清单任务（本地 projectId=''）经 pull 归一回收集箱", async () => {
        const taskRepo = new LocalTaskRepoImpl()
        const [task, err] = await taskRepo.create(makeCreateVO('无清单任务', ''))
        expect(err).toBeNull()
        expect((await localDatabase.tasks.get(task!.id))!.projectId).toBe('')
        // 远端已有同 id 行（本地未改）⇒ pull 走「本地未改」分支
        await localDatabase.syncQueue.clear()

        await pullOnly([remoteTask(task!.id, USER)]).pullAll()

        expect((await localDatabase.tasks.get(task!.id))!.projectId).toBe('inbox')
        expect(await inboxContains(task!.id)).toBe(true)
    })

    it('B 负向：真清单 id ≠ userId 不被误归一（收集箱不命中）', async () => {
        const [project, projectErr] = await new LocalProjectRepoImpl().create(
            new CreateProjectValueObject('真清单', 'more2', '')
        )
        expect(projectErr).toBeNull()
        expect(project!.id).not.toBe(USER)

        const taskRepo = new LocalTaskRepoImpl()
        const [task, taskErr] = await taskRepo.create(makeCreateVO('真清单任务', project!.id))
        expect(taskErr).toBeNull()
        // 清空队列 ⇒ pull 走「本地未改」分支，用服务端行覆盖本地
        await localDatabase.syncQueue.clear()

        await pullOnly([remoteTask(task!.id, project!.id)]).pullAll()

        const record = (await localDatabase.tasks.get(task!.id))!
        expect(record.projectId).toBe(project!.id)
        expect(await inboxContains(task!.id)).toBe(false)
    })

    it("B 负向：空值（'' / undefined）不得被归一为 inbox（T193 空值守门）", async () => {
        const taskRepo = new LocalTaskRepoImpl()
        const [task, err] = await taskRepo.create(makeCreateVO('无清单任务', ''))
        expect(err).toBeNull()

        // `''` = 「无清单」的合法本地表示 ⇒ 不得归一
        await localDatabase.syncQueue.clear()
        await pullOnly([remoteTask(task!.id, '')]).pullAll()
        expect((await localDatabase.tasks.get(task!.id))!.projectId).toBe('')
        expect(await inboxContains(task!.id)).toBe(false)

        // 缺失（undefined）同样不得归一（防裸 `String()` 的 'undefined' === 'undefined' 误判）
        await localDatabase.syncQueue.clear()
        await pullOnly([
            { ...remoteTask(task!.id, ''), projectId: undefined } as unknown as ReturnType<
                typeof remoteTask
            >
        ]).pullAll()
        expect((await localDatabase.tasks.get(task!.id))!.projectId).not.toBe('inbox')
        expect(await inboxContains(task!.id)).toBe(false)
    })
})