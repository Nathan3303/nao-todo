import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import type { GetTasksOptions } from '@nao-todo/shared/constants/task'
import { QueryOptionsValueObject } from '@nao-todo/shared/valueobjects/query-options'
import { defaultBuiltInProjectPreferences } from '../../built-in/project/default'
import { localDatabase } from '../db/local-database'
import { LocalProjectRepoImpl } from '../repos/project-repo-impl'
import { LocalTaskRepoImpl } from '../repos/task-repo-impl'
import { CreateProjectValueObject } from '@nao-todo/domain-project'
import { makeTaskVO, setup } from './local-repos-test-helpers'

/**
 * T178 用例先行 · 红基线（清单归档 —— 可见性 L1）
 *
 * 真源：`docs/adr/2026-09-24-project-archive.md`（r1）§3.2 L1 / Q2：
 *   本地任务仓储 `list()` **未传 `isArchived` ⇒ 默认排除归档**（视同 `false`）——
 *   单一杠杆覆盖「清单视图」+「内置视图 8+ 个 `getTasksOptions`」。
 *   显式 `isArchived=true` 才包含。
 *
 * ⚠️ 红基线：当前 `list()` 未传 `isArchived` 时不过滤归档 ⇒ 默认口径断言应 **红**；
 *    `isArchived=false` 与 `=true` 的显式语义为 **绿**保守护栏。不改任何实现文件。
 */

const ARCHIVED_AT = '2026-09-01T00:00:00.000Z'

const toQuery = (options: GetTasksOptions): string =>
    new QueryOptionsValueObject(options as Record<string, unknown>).toString()

/** 让任务「足以匹配该视图的其它谓词」，再打上归档位（用于证明归档是唯一排除原因） */
const makeMatchingArchivedTask = async (options: GetTasksOptions, projectId: string) => {
    const repo = new LocalTaskRepoImpl()
    const [task] = await repo.create(
        makeTaskVO({
            name: `匹配任务-${options.projectId ?? 'x'}`,
            projectId: options.projectId === 'inbox' ? 'inbox' : projectId,
            state: options.state ? options.state.split(',')[0] : 'todo',
            endAt:
                options.relativeDate === 'tomorrow'
                    ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                    : options.relativeDate === '-today'
                      ? '2000-01-01T00:00:00.000Z'
                      : new Date().toISOString()
        })
    )
    const record = (await localDatabase.tasks.get(task!.id))!
    const patched = { ...record }
    if (options.isStarMarked) patched.starMarkAt = ARCHIVED_AT
    if (options.isGivenUp) patched.givenUpAt = ARCHIVED_AT
    if (options.isDeleted) patched.deletedAt = ARCHIVED_AT
    // 归档位 = 可见性判据（任务自身字段，§3.1）
    patched.archivedAt = ARCHIVED_AT
    await localDatabase.tasks.put(patched)
    return task!.id
}

describe('T178 · 面6 L1：任务仓储 list() 默认排除归档', () => {
    beforeEach(async () => {
        await setup()
    })

    it('list() 未传 isArchived ⇒ 排除归档任务（L1 核心）', async () => {
        const repo = new LocalTaskRepoImpl()
        const [active] = await repo.create(makeTaskVO({ name: '活动任务' }))
        const [archived] = await repo.create(makeTaskVO({ name: '归档任务' }))
        await localDatabase.tasks.put({
            ...(await localDatabase.tasks.get(archived!.id))!,
            archivedAt: ARCHIVED_AT
        })

        const [result, err] = await repo.list()
        expect(err).toBeNull()
        const ids = result!.taskEntities.map((t) => t.id)
        expect(ids).toContain(active!.id)
        expect(ids).not.toContain(archived!.id)
    })

    it('list(isArchived=true) ⇒ 仅归档任务（显式语义保守护栏）', async () => {
        const repo = new LocalTaskRepoImpl()
        const [active] = await repo.create(makeTaskVO({ name: '活动任务' }))
        const [archived] = await repo.create(makeTaskVO({ name: '归档任务' }))
        await localDatabase.tasks.put({
            ...(await localDatabase.tasks.get(archived!.id))!,
            archivedAt: ARCHIVED_AT
        })

        const [result] = await repo.list('isArchived=true')
        const ids = result!.taskEntities.map((t) => t.id)
        expect(ids).toContain(archived!.id)
        expect(ids).not.toContain(active!.id)
    })

    it('list(isArchived=false) ⇒ 排除归档（5 处已显式传参的保守护栏）', async () => {
        const repo = new LocalTaskRepoImpl()
        const [archived] = await repo.create(makeTaskVO({ name: '归档任务' }))
        await localDatabase.tasks.put({
            ...(await localDatabase.tasks.get(archived!.id))!,
            archivedAt: ARCHIVED_AT
        })

        const [result] = await repo.list('isDeleted=false&isArchived=false')
        expect(result!.taskEntities.map((t) => t.id)).not.toContain(archived!.id)
    })
})

describe('T178 · 面6 清单视图（L1 覆盖）：偏好 getTasksOptions 未带 isArchived 时仍排除', () => {
    beforeEach(async () => {
        await setup()
    })

    it('典型清单视图偏好 {limit,isGivenUp:false,projectId} ⇒ 归档任务不出现在清单', async () => {
        const projectRepo = new LocalProjectRepoImpl()
        const [project] = await projectRepo.create(
            new CreateProjectValueObject('清单', 'more2', '')
        )
        const repo = new LocalTaskRepoImpl()
        const [active] = await repo.create(makeTaskVO({ name: '活动', projectId: project!.id }))
        const [archived] = await repo.create(makeTaskVO({ name: '归档', projectId: project!.id }))
        await localDatabase.tasks.put({
            ...(await localDatabase.tasks.get(archived!.id))!,
            archivedAt: ARCHIVED_AT
        })

        const query = toQuery({ limit: 20, isGivenUp: false, projectId: project!.id })
        const [result, err] = await repo.list(query)
        expect(err).toBeNull()
        const ids = result!.taskEntities.map((t) => t.id)
        expect(ids).toContain(active!.id)
        expect(ids).not.toContain(archived!.id)
    })
})

describe('T178 · 面6 内置视图：逐处 getTasksOptions（L1 覆盖）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('内置清单偏好非空（前置：至少 8 个视图）', () => {
        expect(defaultBuiltInProjectPreferences.length).toBeGreaterThanOrEqual(8)
    })

    for (const preference of defaultBuiltInProjectPreferences) {
        const options = JSON.parse(preference.getTasksOptions) as GetTasksOptions
        it(`内置视图「${preference.projectId}」：归档任务不出现（未显式传 isArchived 亦排除）`, async () => {
            const repo = new LocalTaskRepoImpl()
            const taskId = await makeMatchingArchivedTask(options, 'p-builtin')

            const [result, err] = await repo.list(toQuery(options))
            expect(err).toBeNull()
            expect(result!.taskEntities.map((t) => t.id)).not.toContain(taskId)
        })
    }
})