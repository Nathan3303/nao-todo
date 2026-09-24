import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { GoAsync } from '@nao-todo/shared/types'
import { CreateProjectValueObject } from '@nao-todo/domain-project'
import { UpdateTaskValueObject } from '@nao-todo/domain-task'
import { localDatabase } from '../db/local-database'
import { LocalProjectRepoImpl } from '../repos/project-repo-impl'
import { LocalTaskRepoImpl } from '../repos/task-repo-impl'
import { makeTaskVO, setup } from './local-repos-test-helpers'

/**
 * T178 用例先行 · 红基线（清单归档 —— 本地持久化/级联面）
 *
 * 真源：`docs/adr/2026-09-24-project-archive.md`（r1）
 *   - Q1 / PA-5：新增任务仓储 `archiveByProjectId` / `unarchiveByProjectId`（批量），
 *                清单 + 任务**同一 Dexie `rw` 事务**。
 *   - PA-6：只改状态确实要变的行（归档跳过已归档；恢复只恢复仍归档的）。
 *   - PA-7：级联**逐任务 `markDirty`**（计数 = 受影响任务数）。
 *   - §4.2 / DP-3：二次确认的 N = 「未归档且未删除」计数（可用 `list(projectId)` 默认口径取）。
 *   - Q4：单任务脱归档 = `archivedAt = null` + `projectId = 'inbox'`（同批写）。
 *   - §7.3 / PA-10：归档保留 `sortId`；碰撞按锚归一。
 *
 * ⚠️ 红基线：`archiveByProjectId` / `unarchiveByProjectId` / `UpdateTaskValueObject.archivedAt`
 *    当前不存在 ⇒ 结构断言与行为断言应 **红**；已有行为（sortId 保留、活动项过滤）为 **绿**保守护栏。
 *    不改任何实现文件。
 */

/** ADR Q1 期望形状：任务仓储新增两个批量级联方法 */
type TaskRepoWithCascade = LocalTaskRepoImpl & {
    archiveByProjectId?: (projectId: string) => GoAsync<void>
    unarchiveByProjectId?: (projectId: string) => GoAsync<void>
}

const asCascadeRepo = (repo: LocalTaskRepoImpl): TaskRepoWithCascade =>
    repo as unknown as TaskRepoWithCascade

const createProject = async (name: string, sortId?: number) => {
    const repo = new LocalProjectRepoImpl()
    const [entity, err] = await repo.create(new CreateProjectValueObject(name, 'more2', ''))
    expect(err).toBeNull()
    if (sortId !== undefined) {
        const raw = await localDatabase.projects.get(entity!.id)
        await localDatabase.projects.put({ ...raw!, sortId })
    }
    return entity!
}

const countTaskQueue = async (): Promise<number> => {
    const all = await localDatabase.syncQueue.toArray()
    return all.filter((r) => r.table === 'tasks').length
}

describe('T178 · 面2 客户端级联（archiveByProjectId / unarchiveByProjectId，ADR Q1）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('任务仓储应暴露 archiveByProjectId / unarchiveByProjectId（结构断言）', () => {
        const repo = asCascadeRepo(new LocalTaskRepoImpl())
        expect(typeof repo.archiveByProjectId).toBe('function')
        expect(typeof repo.unarchiveByProjectId).toBe('function')
    })

    it('归档清单 ⇒ 其下「未删除且未归档」任务全部置 archivedAt，且跳过已归档', async () => {
        const repo = asCascadeRepo(new LocalTaskRepoImpl())
        const project = await createProject('级联清单')

        const [t1] = await repo.create(makeTaskVO({ name: '任务1', projectId: project.id }))
        const [t2] = await repo.create(makeTaskVO({ name: '任务2', projectId: project.id }))
        const [t3] = await repo.create(makeTaskVO({ name: '已归档任务', projectId: project.id }))
        const [other] = await repo.create(makeTaskVO({ name: '他清单任务', projectId: 'p-other' }))
        // 预置 t3 为已归档、other 为他清单
        await localDatabase.tasks.put({
            ...(await localDatabase.tasks.get(t3!.id))!,
            archivedAt: '2026-09-01T00:00:00.000Z'
        })

        if (typeof repo.archiveByProjectId !== 'function') {
            throw new Error('archiveByProjectId 未实现（ADR Q1 客户端级联）')
        }
        const err = await repo.archiveByProjectId(project.id)
        expect(err).toBeNull()

        const rawT1 = await localDatabase.tasks.get(t1!.id)
        const rawT2 = await localDatabase.tasks.get(t2!.id)
        const rawT3 = await localDatabase.tasks.get(t3!.id)
        const rawOther = await localDatabase.tasks.get(other!.id)
        expect(rawT1!.archivedAt).toBeTruthy()
        expect(rawT2!.archivedAt).toBeTruthy()
        expect(rawT3!.archivedAt).toBe('2026-09-01T00:00:00.000Z') // PA-6：不重写已归档行
        expect(rawOther!.archivedAt ?? '').toBe('') // 不越界改他清单
        // PA-4：归档路径不写删除位
        expect(rawT1!.deletedAt).toBeNull()
        expect(rawT2!.deletedAt).toBeNull()
    })

    it('恢复清单 ⇒ 只恢复「仍归档」的任务（已单任务脱归档的不复活）', async () => {
        const repo = asCascadeRepo(new LocalTaskRepoImpl())
        const project = await createProject('恢复清单')
        const [t1] = await repo.create(makeTaskVO({ name: '归档任务', projectId: project.id }))
        const [t2] = await repo.create(makeTaskVO({ name: '已脱归档任务', projectId: project.id }))
        await localDatabase.tasks.put({
            ...(await localDatabase.tasks.get(t1!.id))!,
            archivedAt: '2026-09-01T00:00:00.000Z'
        })
        await localDatabase.tasks.put({
            ...(await localDatabase.tasks.get(t2!.id))!,
            archivedAt: null
        })

        if (typeof repo.unarchiveByProjectId !== 'function') {
            throw new Error('unarchiveByProjectId 未实现（ADR Q1 客户端级联）')
        }
        const err = await repo.unarchiveByProjectId(project.id)
        expect(err).toBeNull()

        expect((await localDatabase.tasks.get(t1!.id))!.archivedAt).toBeNull()
        expect((await localDatabase.tasks.get(t2!.id))!.archivedAt).toBeNull()
    })

    it('级联必须在同一 Dexie rw 事务内（PA-5）', async () => {
        const repo = asCascadeRepo(new LocalTaskRepoImpl())
        const project = await createProject('事务清单')
        await repo.create(makeTaskVO({ name: '任务1', projectId: project.id }))
        await repo.create(makeTaskVO({ name: '任务2', projectId: project.id }))

        if (typeof repo.archiveByProjectId !== 'function') {
            throw new Error('archiveByProjectId 未实现（ADR Q1 客户端级联）')
        }
        const txSpy = vi.spyOn(localDatabase, 'transaction')
        let rwCall: unknown[] | undefined
        try {
            await repo.archiveByProjectId(project.id)
            // ⚠️ T180 修正：`mockRestore()` 会清空 `mock.calls` ⇒ 必须在 restore 前读取
            rwCall = (txSpy.mock.calls as unknown[][]).find(
                (call) =>
                    call[0] === 'rw' &&
                    call.includes(localDatabase.projects) &&
                    call.includes(localDatabase.tasks)
            )
        } finally {
            txSpy.mockRestore()
        }
        expect(rwCall).toBeDefined()
    })

    it('级联逐任务 markDirty（计数 = 受影响任务数，PA-7）', async () => {
        const repo = asCascadeRepo(new LocalTaskRepoImpl())
        const project = await createProject('队列清单')
        await repo.create(makeTaskVO({ name: '任务1', projectId: project.id }))
        await repo.create(makeTaskVO({ name: '任务2', projectId: project.id }))
        await repo.create(makeTaskVO({ name: '任务3', projectId: project.id }))
        // ⚠️ T180 修正：markDirty 按 `${userId}:tasks:${id}` 主键去重（覆盖写不增计数），
        // create 已各入队 1 项 ⇒ 先清空以隔离「级联是否逐任务重新 markDirty」
        await localDatabase.syncQueue.where('table').equals('tasks').delete()
        const before = await countTaskQueue()

        if (typeof repo.archiveByProjectId !== 'function') {
            throw new Error('archiveByProjectId 未实现（ADR Q1 客户端级联）')
        }
        await repo.archiveByProjectId(project.id)

        expect((await countTaskQueue()) - before).toBe(3)
    })
})

describe('T178 · 面3 二次确认 N 口径（§4.2 / DP-3）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('list(projectId=…) 默认计数 = 「未归档且未删除」（不得含归档）', async () => {
        const repo = new LocalTaskRepoImpl()
        const project = await createProject('计数清单')
        await repo.create(makeTaskVO({ name: '活动1', projectId: project.id }))
        await repo.create(makeTaskVO({ name: '活动2', projectId: project.id }))
        const [archived] = await repo.create(makeTaskVO({ name: '归档1', projectId: project.id }))
        const [deleted] = await repo.create(makeTaskVO({ name: '删除1', projectId: project.id }))
        await localDatabase.tasks.put({
            ...(await localDatabase.tasks.get(archived!.id))!,
            archivedAt: '2026-09-01T00:00:00.000Z'
        })
        await localDatabase.tasks.put({
            ...(await localDatabase.tasks.get(deleted!.id))!,
            deletedAt: '2026-09-01T00:00:00.000Z'
        })

        const [result, err] = await repo.list(`projectId=${project.id}`)
        expect(err).toBeNull()
        // N = 2（活动），归档 1 + 删除 1 均不计
        expect(result!.pagination?.total).toBe(2)
    })
})

describe('T178 · 面9 单任务脱归档的字段写入（Q4）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('UpdateTaskValueObject 应支持 archivedAt（脱归档所需，结构断言）', () => {
        const vo = new UpdateTaskValueObject('t-1')
        expect('archivedAt' in (vo as unknown as Record<string, unknown>)).toBe(true)
    })

    it('同批写：archivedAt=null + projectId=inbox 均落库', async () => {
        const repo = new LocalTaskRepoImpl()
        const [task] = await repo.create(makeTaskVO({ name: '归档内任务', projectId: 'p-a' }))
        await localDatabase.tasks.put({
            ...(await localDatabase.tasks.get(task!.id))!,
            archivedAt: '2026-09-01T00:00:00.000Z'
        })

        const vo = new UpdateTaskValueObject(task!.id)
        // 期望形状：VO 支持 archivedAt（当前缺 ⇒ 下一行结构断言会红）
        const shape = vo as unknown as { archivedAt?: string | null }
        expect('archivedAt' in (vo as unknown as Record<string, unknown>)).toBe(true)
        shape.archivedAt = null
        vo.projectId = 'inbox'

        const err = await repo.update(task!.id, vo)
        expect(err).toBeNull()
        const raw = await localDatabase.tasks.get(task!.id)
        expect(raw!.archivedAt ?? '').toBe('')
        expect(raw!.projectId).toBe('inbox')
    })
})

describe('T178 · 面11 复位（sortId 保留，PA-10）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('repo.archive / repo.unarchive 保留 sortId（保守护栏，现状应绿）', async () => {
        const repo = new LocalProjectRepoImpl()
        const project = await createProject('排序清单', 4200)
        expect((await repo.get(project.id))[0]!.sortId).toBe(4200)

        await repo.archive(project.id)
        expect((await repo.get(project.id))[0]!.sortId).toBe(4200)
        await repo.unarchive(project.id)
        expect((await repo.get(project.id))[0]!.sortId).toBe(4200)
    })
})