// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CreateProjectValueObject } from '@nao-todo/domain-project'
import { UpdateTaskValueObject } from '@nao-todo/domain-task'
import { localDatabase } from '../../persistence-local/db/local-database'
import { LocalProjectRepoImpl } from '../../persistence-local/repos/project-repo-impl'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { cascadeProjectArchive } from '../../persistence-local/repos/project-archive-cascade'
import { isAbsentStamp } from '../../persistence-local/utils'
import { makeTaskVO } from '../../persistence-local/__tests__/local-repos-test-helpers'
import type { SyncQueueRecord } from '../../persistence-local/db/local-database'
import {
    USER_ID,
    createSyncedTask,
    makeServer,
    makeService,
    patchLocal,
    resetLocalState
} from './t675-field-merge-harness'

/**
 * T676 / B 批 M1 —— **字段级基准 `fieldBase` 捕获 + 直写点接线**（Issue #340）
 *
 * 口径（ADR D1 / PM 2026-11-10 开工确认卡）：
 * - `fieldBase` = `{ 字段: 写前值 }`，**只含本次写涉及、且与写前值不同的字段**（比较一律 `valuesEqual`）；
 * - 值必须是**明文实体值**（任务 `name`/`description` 落库为 `plain:<明文>` ⇒ 在实体层捕获）；
 * - 缺省零行为变化：无 `fieldBase` 键 ⇒ 下游走保守路径（本批不做合并算法，M2 接入）；
 * - 同实体重复写**首次写胜**（基准只前进，`markDirty` 合并既有 `B`）；
 * - `fieldBase` **只在本地队列内**，不进推送载荷（`entityToPush` 键集不变）。
 *
 * 本文件只覆盖 M1：基准捕获 + 4 处直写点（`put-with-sync-base.ts:54` ·
 * `project-archive-cascade.ts:42,65` · `task-repo-impl.ts` `unarchive`）。
 * 合并内核 / pull / push 接入在 M2–M4，`t675-*` 行为用例继续红属预期。
 */

const queueRecord = (table: string, entityId: string): Promise<SyncQueueRecord | undefined> =>
    localDatabase.syncQueue.get(`${USER_ID}:${table}:${entityId}`)

const createProject = async (): Promise<string> => {
    const [project, err] = await new LocalProjectRepoImpl().create(
        new CreateProjectValueObject('基准捕获清单', 'more2', '')
    )
    expect(err).toBeNull()
    return project!.id
}

/** 任意字段本地写（`TaskSeed` 之外的字段也要能改；与 `patchLocal` 同一条真实仓储写路径） */
const patchRaw = async (id: string, patch: Record<string, unknown>): Promise<void> => {
    const vo = new UpdateTaskValueObject(id)
    Object.assign(vo, patch)
    const err = await newLocalTaskRepository().update(id, vo)
    if (err !== null) throw new Error(`夹具本地写失败: ${err}`)
}

describe('T676 / M1 直写点① put-with-sync-base.ts:54（任务仓储写路径入队）', () => {
    beforeEach(resetLocalState)

    it('改 1 个字段 ⇒ fieldBase 只含该字段，值为写前明文旧值', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        await patchLocal(id, { name: 'B-name' })

        expect((await queueRecord('tasks', id))?.fieldBase).toEqual({ name: 'A0-name' })
    })

    it('改 3 个字段 ⇒ fieldBase 含 3 个键（不含 updatedAt 等同步元数据）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        await patchLocal(id, { name: 'B-name', description: 'B-desc', priority: 'high' })

        const fieldBase = (await queueRecord('tasks', id))?.fieldBase
        expect(fieldBase).toEqual({
            name: 'A0-name',
            description: 'A0-desc',
            priority: 'medium'
        })
        // 同步元数据不进基准（忽略集单一来源）
        expect(fieldBase).not.toHaveProperty('updatedAt')
        expect(fieldBase).not.toHaveProperty('syncedServerUpdatedAt')
    })

    it('未改（写回同值）⇒ 队列项存在但无 fieldBase 键（缺省零行为变化）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        await patchLocal(id, { name: 'A0-name', description: 'A0-desc' })

        const queued = await queueRecord('tasks', id)
        expect(queued).toBeTruthy()
        expect(queued && 'fieldBase' in queued).toBe(false)
    })

    it("空哨兵边界：写前 null × 本次 ''（valuesEqual 归空）⇒ 不捕获；真实变更才捕获", async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        // 写前 `archivedAt` = null；本次写 `''` ⇒ 等价空，不算「我改过」
        await patchRaw(id, { archivedAt: '' })
        const afterEmpty = await queueRecord('tasks', id)
        expect(afterEmpty && 'fieldBase' in afterEmpty).toBe(false)

        // 真实变更：`null → 归档时间` ⇒ 捕获写前值（null）
        const ARCHIVED_AT = '2026-10-01T00:00:00.000Z'
        await patchRaw(id, { archivedAt: ARCHIVED_AT })
        expect((await queueRecord('tasks', id))?.fieldBase).toEqual({ archivedAt: null })
    })

    it('首次写胜：同实体重复写同一字段不覆盖既有基准（B 只前进）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        await patchLocal(id, { name: 'X-name' })
        await patchLocal(id, { name: 'Y-name' })

        expect((await queueRecord('tasks', id))?.fieldBase).toEqual({ name: 'A0-name' })
    })

    it('fieldBase 不进推送载荷（entityToPush 键集不变），推送成功后随队列项消失', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)
        const createPushCount = server.pushBodies.length

        await patchLocal(id, { name: 'B-name' })
        await makeService(server).pushAll()

        const pushed = server.pushBodies[createPushCount] as {
            tasks?: Record<string, unknown>[]
        }
        const payload = pushed.tasks?.[0] ?? {}
        expect(payload).not.toHaveProperty('fieldBase')
        expect(JSON.stringify(pushed)).not.toContain('fieldBase')
        // 业务字段照旧整行推送
        expect(payload.name).toBe('B-name')
        // 队列项（含基准）推送成功后移除，基准不落业务行
        expect(await queueRecord('tasks', id)).toBeUndefined()
        expect(await localDatabase.tasks.get(id)).not.toHaveProperty('fieldBase')
    })
})

describe('T676 / M1 直写点②③ project-archive-cascade.ts:42,65（级联归档）', () => {
    beforeEach(resetLocalState)

    it('清单行 ⇒ fieldBase 含 archivedAt（写前为空哨兵）', async () => {
        const projectId = await createProject()

        expect(await cascadeProjectArchive(localDatabase, projectId, USER_ID, 'archive')).toBeNull()

        const fieldBase = (await queueRecord('projects', projectId))?.fieldBase
        expect(Object.keys(fieldBase ?? {})).toEqual(['archivedAt'])
        expect(isAbsentStamp(fieldBase?.archivedAt as string | null | undefined)).toBe(true)
    })

    it('其下任务行 ⇒ fieldBase 含 archivedAt（写前为空哨兵）', async () => {
        const projectId = await createProject()
        const [task, err] = await newLocalTaskRepository().create(
            makeTaskVO({ name: '级联任务', projectId })
        )
        expect(err).toBeNull()

        expect(await cascadeProjectArchive(localDatabase, projectId, USER_ID, 'archive')).toBeNull()

        const fieldBase = (await queueRecord('tasks', task!.id))?.fieldBase
        expect(Object.keys(fieldBase ?? {})).toEqual(['archivedAt'])
        expect(isAbsentStamp(fieldBase?.archivedAt as string | null | undefined)).toBe(true)
    })
})

describe('T676 / M1 直写点④ task-repo-impl.ts:361（unarchive 脱归档）', () => {
    beforeEach(resetLocalState)

    const ARCHIVED_AT = '2026-09-01T00:00:00.000Z'

    it('脱归档 ⇒ fieldBase 含 archivedAt（写前归档时间）；projectId 未变则不入基准', async () => {
        const projectId = await createProject()
        const [task, err] = await newLocalTaskRepository().create(
            makeTaskVO({ name: '脱归档任务', projectId })
        )
        expect(err).toBeNull()
        // 直接打归档位（与脱归档分支解耦，不依赖级联）
        await localDatabase.tasks.put({
            ...(await localDatabase.tasks.get(task!.id))!,
            archivedAt: ARCHIVED_AT
        })

        const [result, unarchiveErr] = await newLocalTaskRepository().unarchive(task!.id)
        expect(unarchiveErr).toBeNull()
        expect(result?.movedToInbox).toBe(false)

        expect((await queueRecord('tasks', task!.id))?.fieldBase).toEqual({
            archivedAt: ARCHIVED_AT
        })
    })
})