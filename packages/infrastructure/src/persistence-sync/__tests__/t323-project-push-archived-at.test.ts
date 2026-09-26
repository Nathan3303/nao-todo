import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared'
import { CreateProjectValueObject } from '@nao-todo/domain-project'
import { projectRecordToEntity } from '../../persistence-local/converters/project'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import { LocalProjectRepoImpl } from '../../persistence-local/repos/project-repo-impl'
import { syncTracker } from '../sync-tracker'
import { SyncService } from '../sync-service'

/**
 * T323 · `DEF-42` 客户端配合 —— 项目 push 载荷 `archivedAt` + pull 映射
 *
 * 契约（服务端 `T319`/`T322` 三态）：
 *   - push 载荷 **必须包含** `archivedAt`（键存在）；
 *   - 值语义：本地 `null` ⇒ **显式 `null`**（服务端清空）· 有值 ⇒ 原样发；**不引入空串哨兵**；
 *   - pull：服务端未归档表示 `archivedAt: ""` ⇒ 客户端读边界归一并当「无归档」。
 *
 * 本文件钉死三件事：
 *   ① 归档项目 ⇒ 载荷 `archivedAt` = 本地归档时间（原样发）；
 *   ② 取消归档项目 ⇒ 载荷 `archivedAt` **键存在且为 `null`**（非缺省、非 `''`）；
 *   ③ pull 到的 `archivedAt: ""` ⇒ 本地实体读为 `null`，再次 push 发 `null`（非 `''`）。
 */

const USER = '1001'
const ARCHIVED_AT = '2026-09-01T00:00:00.000Z'
const PULLED_EMPTY = ''

type PushProjectRow = { id: string; archivedAt?: unknown; baseUpdatedAt?: string }
type PushBody = { projects?: PushProjectRow[] }

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

/** 服务端项目出参（`archivedAt: ""` = 未归档，对齐服务端 `NullableTime.ToString`） */
const remoteProject = (id: string, archivedAt: string) => ({
    id,
    createdAt: ARCHIVED_AT,
    updatedAt: ARCHIVED_AT,
    deletedAt: '',
    name: 'T323 清单',
    description: '',
    archivedAt,
    deactivedAt: '',
    sortId: 1000,
    taskCount: 0
})

/** 最小 mock server：push 逐条回 `applied`；pull 回一组远端清单行 */
const makeService = (remoteRows: () => Record<string, unknown>[]) => {
    const captured: { body: PushBody | null } = { body: null }
    const requester = {
        post: async (url: string, payload: unknown) => {
            if (url === '/sync/push') {
                captured.body = payload as PushBody
                const rows = (captured.body.projects ?? []).map((row) => ({
                    table: 'projects',
                    id: row.id,
                    serverUpdatedAt: '2026-10-01T00:00:00.000Z',
                    outcome: 'applied'
                }))
                return { data: { data: { results: rows }, serverTime: Date.now() } }
            }
            return {
                data: {
                    data: {
                        data: {
                            tasks: { items: [], nextCursor: null },
                            projects: { items: remoteRows(), nextCursor: null },
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
        },
        get: async () => ({ data: {} }),
        put: async () => ({ data: {} }),
        delete: async () => ({ data: {} })
    } as unknown as Requester
    return { service: new SyncService(requester), captured }
}

const createProject = async (): Promise<string> => {
    const [entity, err] = await new LocalProjectRepoImpl().create(
        new CreateProjectValueObject('T323 清单', 'more2', '')
    )
    expect(err).toBeNull()
    return entity!.id
}

describe('T323 · 项目 push 载荷 archivedAt + pull 映射（DEF-42 客户端配合）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('归档项目 ⇒ 载荷 archivedAt 键存在且 = 本地归档时间（原样发）', async () => {
        const projectId = await createProject()
        const repo = new LocalProjectRepoImpl()
        expect(await repo.archive(projectId)).toBeNull()

        const localArchivedAt = (await localDatabase.projects.get(projectId))!.archivedAt
        expect(localArchivedAt).toBeTruthy()

        const { service, captured } = makeService(() => [])
        await service.pushAll()

        const row = captured.body?.projects?.[0]
        expect(row).toBeDefined()
        expect(Object.hasOwn(row!, 'archivedAt')).toBe(true)
        expect(row!.archivedAt).toBe(localArchivedAt)
    })

    it('取消归档项目 ⇒ 载荷 archivedAt 键存在且为 null（显式清空，非缺省/非空串）', async () => {
        const projectId = await createProject()
        const repo = new LocalProjectRepoImpl()
        expect(await repo.archive(projectId)).toBeNull()
        expect(await repo.unarchive(projectId)).toBeNull()

        const { service, captured } = makeService(() => [])
        await service.pushAll()

        const row = captured.body?.projects?.[0]
        expect(row).toBeDefined()
        expect(Object.hasOwn(row!, 'archivedAt')).toBe(true)
        expect(row!.archivedAt).toBeNull()
        // pull 之后再次 push 亦然（未被覆盖成空串）
        expect((await localDatabase.projects.get(projectId))!.archivedAt).toBeNull()
    })

    it('pull 到 archivedAt: "" ⇒ 本地实体读为 null，再次 push 发 null（非空串哨兵）', async () => {
        const projectId = await createProject()
        await localDatabase.syncQueue.clear()

        const { service, captured } = makeService(() => [remoteProject(projectId, PULLED_EMPTY)])
        await service.pullAll()

        // ② 读边界：本地实体把 "" 当「无归档」
        const record = await localDatabase.projects.get(projectId)
        expect(record).toBeDefined()
        const entity = await projectRecordToEntity(record!)
        expect(entity.archivedAt).toBeNull()

        // ③ 该行再次 push：载荷必须是显式 null（不是 ""）
        await syncTracker.markDirty('projects', projectId, 'upsert', record!.updatedAt)
        await service.pushAll()
        const row = captured.body?.projects?.find((item) => item.id === projectId)
        expect(row).toBeDefined()
        expect(row!.archivedAt).toBeNull()
        expect(row!.archivedAt).not.toBe('')
    })
})