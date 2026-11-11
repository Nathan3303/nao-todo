// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { UpdateTaskValueObject } from '@nao-todo/domain-task'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { SYNC_TABLES } from '../sync-service'
import {
    AUDIT_ACTIONS,
    AUDIT_SOURCES,
    USER_ID,
    countAudit,
    readAudit,
    resetAuditState
} from './t697-audit-harness'
import { makeTaskVO } from '../../persistence-local/__tests__/local-repos-test-helpers'

/**
 * T697 / A 档 M0 —— **AC1（本机编辑 ⇒ 1 条字段级 diff）+ AC7（墓碑动作）+ 枚举**
 *
 * 红基线口径（PM 明令：强红因，⛔ 不得是「模块不存在 / 收集失败」）：
 * 审计经由**测试侧探针**读（表缺失 ⇒ `[]`）⇒ 每条用例以
 * `expected 1 audit entry, received 0` 一类的 AC 级断言失败，而不是 import 崩溃。
 *
 * 冻结口径（实现须对齐，来自 PRD/ADR/评审，非本文件自创）：
 * - **R-3**：一次业务写 ⇒ **1 条**；`fields` 按 `entityToPush` 键序稳定输出（⛔ 不逐字段成条）；
 * - **R-2**：只记**实际变化**的字段，判等用 `valuesEqual`（空哨兵 `''`/`null`/`[]` 等价）；
 * - **AC7**：删除 / 归档 / 取消归档 / 恢复各 **1 条**，`action` 正确，且**墓碑/归档动作不产字段噪声**
 *   （`fields` 为空数组；`archivedAt`/`deletedAt` 不进 `fields`）——见 T696 §3.1 落点表备注；
 * - **R-4**：来源四值固定。
 * @see docs/prds/2026-11-10-audit-log.md（AC1 / AC7 / R-2 / R-3 / R-4）
 * @see docs/reports/T696-audit-log-arch-review.md（§3.1 落点 / §10.1 AC1 判据）
 */

/** `tasks` 推送键序（= 审计 `fields` 的稳定顺序；由生产单一事实源派生，⛔ 不硬编码副本） */
const TASK_FIELD_ORDER = Object.keys(
    SYNC_TABLES.find((config) => config.table === 'tasks')!.entityToPush({})
)

const seedTask = async (overrides: Parameters<typeof makeTaskVO>[0] = {}): Promise<string> => {
    const repo = newLocalTaskRepository()
    const [task, err] = await repo.create(makeTaskVO(overrides))
    expect(err).toBeNull()
    return task!.id
}

const patch = async (id: string, changes: Record<string, unknown>): Promise<void> => {
    const vo = new UpdateTaskValueObject(id)
    for (const [field, value] of Object.entries(changes)) {
        ;(vo as unknown as Record<string, unknown>)[field] = value
    }
    const err = await newLocalTaskRepository().update(id, vo)
    expect(err).toBeNull()
}

describe('T697 / AC1 本机编辑：1 条记录 + 字段级 diff + 稳定顺序', () => {
    beforeEach(resetAuditState)

    it('改 3 个字段（name/description/priority）⇒ 恰 1 条，fields 恰为这 3 个字段且按推送键序', async () => {
        const id = await seedTask({ projectId: 'project-1' })

        await patch(id, { priority: 'high', description: 'A1-desc', name: 'A1-name' })

        const entries = await readAudit()
        // AC1-① 恰 1 条（⛔ 不得 3 条「逐字段成条」）
        expect(entries).toHaveLength(1)
        const entry = entries[0]!
        expect(entry.entity).toBe('tasks')
        expect(entry.entityId).toBe(id)
        expect(entry.source).toBe('local-edit')
        expect(entry.action).toBe('update')
        // AC1-② 字段集 + 顺序（= entityToPush 键序过滤后）
        const expectedOrder = TASK_FIELD_ORDER.filter((field) =>
            ['name', 'description', 'priority'].includes(field)
        )
        expect(entry.fields.map((diff) => diff.field)).toEqual(expectedOrder)
        // 值形状 = 实体明文（⛔ 不是记录层 `plain:` 形状）
        const byField = Object.fromEntries(entry.fields.map((diff) => [diff.field, diff]))
        expect(byField.name).toEqual({ field: 'name', from: '测试任务', to: 'A1-name' })
        expect(byField.description).toEqual({
            field: 'description',
            from: '',
            to: 'A1-desc'
        })
        expect(byField.priority).toEqual({ field: 'priority', from: 'medium', to: 'high' })
        // AC1-③ 时间 = 本机写时刻（±5s）
        const at = Date.parse(entry.at)
        expect(Number.isFinite(at)).toBe(true)
        expect(Math.abs(at - Date.now())).toBeLessThan(5000)
        // R-4：来源必须是四值之一
        expect(AUDIT_SOURCES as readonly string[]).toContain(entry.source)
    })

    it('同一字段连写两次（第二次与库中值相同）⇒ 只记真正变化的那一次（0 条新增）', async () => {
        const id = await seedTask()
        await patch(id, { name: 'B1-name' })
        expect(await countAudit()).toBe(1)

        // 再写一次相同值：值没变 ⇒ 不得新增条目（判据是「落库前后是否真的变了」）
        await patch(id, { name: 'B1-name' })

        expect(await countAudit()).toBe(1)
    })

    it("空哨兵等价（startAt: null 写到已是 '' 的任务）⇒ 0 条（valuesEqual 口径，`!==` 会误判）", async () => {
        const id = await seedTask()
        expect(await countAudit()).toBe(0)

        await patch(id, { startAt: null, endAt: null, remindAt: null })

        expect(await countAudit()).toBe(0)
    })

    it('create ⇒ 1 条 action=create 且 fields 为空数组（新建不产字段噪声）', async () => {
        const id = await seedTask({ name: 'C1-created' })

        const entries = await readAudit()
        expect(entries).toHaveLength(1)
        expect(entries[0]!).toMatchObject({
            entity: 'tasks',
            entityId: id,
            action: 'create',
            source: 'local-edit'
        })
        expect(entries[0]!.fields).toEqual([])
    })
})

describe('T697 / AC7 墓碑与归档动作：1 条 + action 正确 + 无字段噪声', () => {
    beforeEach(resetAuditState)

    it('删除 ⇒ 1 条 action=delete，fields 为空（deletedAt 不进 fields）', async () => {
        const id = await seedTask()
        const err = await newLocalTaskRepository().remove(id)
        expect(err).toBeNull()

        const entries = await readAudit()
        expect(entries).toHaveLength(1)
        expect(entries[0]!).toMatchObject({ entityId: id, action: 'delete' })
        expect(entries[0]!.fields).toEqual([])
    })

    it('归档 ⇒ 1 条 action=archive，fields 为空（archivedAt 不进 fields）', async () => {
        const id = await seedTask()
        await patch(id, { archivedAt: new Date().toISOString() })

        const entries = await readAudit()
        expect(entries).toHaveLength(1)
        expect(entries[0]!).toMatchObject({ entityId: id, action: 'archive' })
        expect(entries[0]!.fields).toEqual([])
    })

    it('取消归档 ⇒ 1 条 action=unarchive，fields 为空（清单仍存活 ⇒ 不搬收集箱）', async () => {
        const id = await seedTask()
        await patch(id, { archivedAt: new Date().toISOString() })

        const [result, err] = await newLocalTaskRepository().unarchive(id)
        expect(err).toBeNull()
        expect(result).toEqual({ movedToInbox: false })

        const entries = await readAudit()
        expect(entries).toHaveLength(1)
        expect(entries[0]!).toMatchObject({ entityId: id, action: 'unarchive' })
        expect(entries[0]!.fields).toEqual([])
    })

    it('恢复 ⇒ 1 条 action=restore，fields 为空（deletedAt 复原不产字段噪声）', async () => {
        const id = await seedTask()
        expect(await newLocalTaskRepository().remove(id)).toBeNull()
        const err = await newLocalTaskRepository().restore(id)
        expect(err).toBeNull()

        const entries = await readAudit()
        expect(entries).toHaveLength(1)
        expect(entries[0]!).toMatchObject({ entityId: id, action: 'restore' })
        expect(entries[0]!.fields).toEqual([])
    })

    it('动作值必须落在枚举内（R-4 同级的固定词表；⛔ 造新词）', async () => {
        const id = await seedTask()
        await patch(id, { name: 'D1-name' })
        await newLocalTaskRepository().remove(id)

        const entries = await readAudit()
        expect(entries.length).toBeGreaterThan(0)
        for (const entry of entries) {
            expect(AUDIT_ACTIONS as readonly string[]).toContain(entry.action)
            expect(entry.userId).toBe(USER_ID)
        }
    })
})