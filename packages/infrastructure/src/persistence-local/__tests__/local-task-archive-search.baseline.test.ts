import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { QueryOptionsValueObject } from '@nao-todo/shared/valueobjects/query-options'
import { localDatabase } from '../db/local-database'
import { LocalTaskRepoImpl } from '../repos/task-repo-impl'
import { makeTaskVO, setup } from './local-repos-test-helpers'

/**
 * T178b 用例先行 · 红基线（清单归档 —— 面7 搜索「包含已归档」开关：仓储行为级）
 *
 * 真源：`docs/adr/2026-09-24-project-archive.md` §15.2（`T175b` 冻结命名）：
 *   - 共享查询选项 **`GetTasksOptions.includeArchived?: boolean`**（与 `includeExcluded` 对称）；
 *     语义 = **不按归档态过滤（包含已归档）**，且**优先级高于 `isArchived`**；
 *   - 本地仓储 `list()`：**`includeArchived === 'true'` ⇒ 不加归档过滤**；
 *     否则维持 L1 默认排除 / 显式 `isArchived`。
 *
 * ⚠️ 红基线：`list()` 尚未识别 `includeArchived`（未传时 L1 默认排除也尚未落地）⇒ 本文件应 **红**。
 *    不改任何实现文件。UI 开关宿主的 URL 往返与 i18n 键见
 *    `apps/web/src/components/search/__tests__/search-include-archived.baseline.test.ts`。
 */

const ARCHIVED_AT = '2026-09-01T00:00:00.000Z'

const toQuery = (options: Record<string, unknown>): string =>
    new QueryOptionsValueObject(options).toString()

/** 建「活动 + 归档」两条任务，返回 id */
const seedTasks = async (): Promise<{ activeId: string; archivedId: string }> => {
    const repo = new LocalTaskRepoImpl()
    const [active] = await repo.create(makeTaskVO({ name: '活动任务' }))
    const [archived] = await repo.create(makeTaskVO({ name: '归档任务' }))
    await localDatabase.tasks.put({
        ...(await localDatabase.tasks.get(archived!.id))!,
        archivedAt: ARCHIVED_AT
    })
    return { activeId: active!.id, archivedId: archived!.id }
}

describe('T178b · 面7 搜索开关 includeArchived（本地仓储 list()，行为级）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('includeArchived=true ⇒ 不加归档过滤（命中归档任务）', async () => {
        const { activeId, archivedId } = await seedTasks()
        const repo = new LocalTaskRepoImpl()

        const [result, err] = await repo.list(toQuery({ includeArchived: true, isDeleted: false }))

        expect(err).toBeNull()
        const ids = result!.taskEntities.map((t) => t.id)
        expect(ids).toContain(archivedId)
        expect(ids).toContain(activeId)
    })

    it('includeArchived=false ⇒ 排除归档任务（与缺省同口径）', async () => {
        const { activeId, archivedId } = await seedTasks()
        const repo = new LocalTaskRepoImpl()

        const [result, err] = await repo.list(toQuery({ includeArchived: false, isDeleted: false }))

        expect(err).toBeNull()
        const ids = result!.taskEntities.map((t) => t.id)
        expect(ids).toContain(activeId)
        expect(ids).not.toContain(archivedId)
    })

    it('缺省（未传 includeArchived）⇒ 排除归档任务（L1 默认）', async () => {
        const { activeId, archivedId } = await seedTasks()
        const repo = new LocalTaskRepoImpl()

        const [result, err] = await repo.list(toQuery({ isDeleted: false }))

        expect(err).toBeNull()
        const ids = result!.taskEntities.map((t) => t.id)
        expect(ids).toContain(activeId)
        expect(ids).not.toContain(archivedId)
    })

    it('includeArchived=true 优先于显式 isArchived=false（ADR §15.2 优先级）', async () => {
        const { archivedId } = await seedTasks()
        const repo = new LocalTaskRepoImpl()

        const [result, err] = await repo.list(
            toQuery({ includeArchived: true, isArchived: false, isDeleted: false })
        )

        expect(err).toBeNull()
        expect(result!.taskEntities.map((t) => t.id)).toContain(archivedId)
    })
})