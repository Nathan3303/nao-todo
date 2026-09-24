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
 * T190 · `DEF-37` 修复（`T188` C + B）**独立端到端探针**（qa 自写，不复用 `t188` 用例）
 *
 * 目的：在 `T188` 之后，由 qa 独立跑通「单任务脱归档（清单仍归档）→ push → pull」全链路，
 * 逐条给出 `PM[T190]` 要求的 5 点证据 + 两侧负向边界：
 *  ① push 载荷 `projectId === ''`（写侧 C）
 *  ② push 回执 `outcome === 'applied'`（修前为 `error`）
 *  ③ 队列项已出队（不再业务退避/积压）
 *  ④ pull 落库后本地 `projectId === 'inbox'`（读侧 B）
 *  ⑤ `list('projectId=inbox')` **命中**（S2 正向不变量）
 *  反向 A：真清单 id 在写侧**不得**被改写成 `''`
 *  反向 B：真清单 id 在读侧**不得**被误归一为 `'inbox'`
 *  顺带：既有 `''`（无清单）创建任务经 pull **受益**（B 覆盖既有缺口）
 *
 * 探针自带最小 mock server：完全复现服务端 create 路径语义（`''` ⇒ `userId`；字面 `'inbox'` ⇒ error），
 * 与 `t188` 的替身无关（独立实现）。
 */

const USER = '1001'
const ARCHIVED_AT = '2026-09-01T00:00:00.000Z'
const FUTURE = '2026-12-01T00:00:00.000Z'
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

type PushTaskRow = {
    id: string
    projectId: unknown
    archivedAt: unknown
}
type PushBody = { tasks?: PushTaskRow[] }
type PushResultRow = { table: string; id: string; outcome?: string; error?: string }

/** 最小 mock server：push 复现 Go create 语义；pull 回一组远端任务行 */
const makeService = (remoteTasks: () => Record<string, unknown>[]) => {
    const captured: { body: PushBody | null; results: PushResultRow[] } = {
        body: null,
        results: []
    }
    // 响应体形状对齐 SyncService 期望：push `{ data: { results } }`；pull `{ data: { data: { [table] } } }`
    const body = (url: string, payload: unknown): unknown => {
        if (url === '/sync/push') {
            captured.body = payload as PushBody
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
        }
        return {
            data: {
                data: {
                    tasks: { items: remoteTasks(), nextCursor: null },
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
    const service = new SyncService({
        post: async (url: string, payload: unknown) => ({ data: body(url, payload) }),
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    } as unknown as Requester)
    return { service, captured }
}

const makeVO = (name: string, projectId: string): CreateTaskValueObject =>
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

const inboxIds = async (): Promise<string[]> => {
    const [result, err] = await new LocalTaskRepoImpl().list(INBOX_QUERY)
    expect(err).toBeNull()
    return (result?.taskEntities ?? []).map((entity) => entity.id)
}

/** 建「归档清单 + 其下已归档任务」，并清空同步队列（模拟两端已同步的基线态） */
const seedArchived = async (): Promise<{ taskId: string; projectId: string }> => {
    const projectRepo = new LocalProjectRepoImpl()
    const taskRepo = new LocalTaskRepoImpl()
    const [project, projectErr] = await projectRepo.create(
        new CreateProjectValueObject('归档清单 T190', 'more2', '')
    )
    expect(projectErr).toBeNull()
    expect(await projectRepo.archive(project!.id)).toBeNull()
    const [task, taskErr] = await taskRepo.create(makeVO('归档任务 T190', project!.id))
    expect(taskErr).toBeNull()
    await localDatabase.tasks.update(task!.id, {
        archivedAt: ARCHIVED_AT,
        updatedAt: ARCHIVED_AT,
        syncedServerUpdatedAt: ARCHIVED_AT
    })
    await localDatabase.syncQueue.clear()
    return { taskId: task!.id, projectId: project!.id }
}

const remoteRow = (id: string, projectId: string, name: string) => ({
    id,
    createdAt: FUTURE,
    updatedAt: FUTURE,
    deletedAt: null,
    parentTaskId: '',
    name,
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

describe('T190 · DEF-37 修复（T188 C+B）独立端到端探针', () => {
    beforeEach(async () => {
        await setup()
    })

    it('①–⑤ 脱归档（清单仍归档）⇒ 写侧 "" / applied / 出队 / 读侧归一回 inbox / 收集箱命中', async () => {
        const { taskId } = await seedArchived()
        const taskRepo = new LocalTaskRepoImpl()

        // 前置：脱归档 ⇒ 本地字面 'inbox'
        const [payload, err] = await taskRepo.unarchive(taskId)
        expect(err).toBeNull()
        expect(payload).toEqual({ movedToInbox: true })
        expect((await localDatabase.tasks.get(taskId))!.projectId).toBe('inbox')

        const { service, captured } = makeService(() => [remoteRow(taskId, USER, '归档任务 T190')])
        await service.pushAll()

        // ① 写侧：载荷 projectId = ''（而非字面 'inbox'）
        expect(captured.body?.tasks?.[0]?.projectId).toBe('')
        // 附带：脱归档的 archivedAt 一并推送（证明变更内容完整，非仅 swap id）
        expect(captured.body?.tasks?.[0]?.archivedAt).toBeNull()
        // ② mock server 回执 applied（修前 'inbox' ⇒ error；该回执亦驱动下方 §③ 的真实出队）
        expect(captured.results.find((row) => row.id === taskId)?.outcome).toBe('applied')
        // ③ 出队（端到端强证据：SyncService 确实消费到 applied 并删除队列项）
        const dirty = await syncTracker.listDirty()
        expect(dirty.some((item) => item.entityId === taskId)).toBe(false)

        await service.pullAll()
        // ④ 读侧：远端 userId（隐式桶）⇒ 本地归一回 'inbox'
        expect((await localDatabase.tasks.get(taskId))!.projectId).toBe('inbox')
        // ⑤ 收集箱过滤命中（S2 正向不变量）
        expect(await inboxIds()).toContain(taskId)
    })

    it('反向 A：真清单 id 写侧原样发送（C 不得改写真 id）', async () => {
        const taskRepo = new LocalTaskRepoImpl()
        const [task, err] = await taskRepo.create(makeVO('真清单任务 T190', 'p-42'))
        expect(err).toBeNull()

        const { service, captured } = makeService(() => [remoteRow(task!.id, 'p-42', '真清单任务')])
        await service.pushAll()

        expect(captured.body?.tasks?.[0]?.projectId).toBe('p-42')
        expect(captured.results[0]?.outcome).toBe('applied')
    })

    it('反向 B：真清单 id 读侧不被误归一（pull 后仍 p-42，收集箱不命中）', async () => {
        const taskRepo = new LocalTaskRepoImpl()
        const [task, err] = await taskRepo.create(makeVO('真清单任务 T190', 'p-42'))
        expect(err).toBeNull()
        await localDatabase.syncQueue.clear()

        const { service } = makeService(() => [remoteRow(task!.id, 'p-42', '真清单任务')])
        await service.pullAll()

        expect((await localDatabase.tasks.get(task!.id))!.projectId).toBe('p-42')
        expect(await inboxIds()).not.toContain(task!.id)
    })

    it('顺带：既有 ""（无清单）创建任务经 pull 受益（服务端 userId ⇒ 本地 inbox）', async () => {
        const taskRepo = new LocalTaskRepoImpl()
        const [task, err] = await taskRepo.create(makeVO('无清单任务 T190', ''))
        expect(err).toBeNull()
        await localDatabase.syncQueue.clear()

        const { service } = makeService(() => [remoteRow(task!.id, USER, '无清单任务')])
        await service.pullAll()

        expect((await localDatabase.tasks.get(task!.id))!.projectId).toBe('inbox')
        expect(await inboxIds()).toContain(task!.id)
    })
})