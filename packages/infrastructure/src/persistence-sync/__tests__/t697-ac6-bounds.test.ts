// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { UpdateTaskValueObject } from '@nao-todo/domain-task'
import { localDatabase, type ProjectRecord } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import {
    AUDIT_ENTRY_BYTE_BUDGET,
    AUDIT_LIMIT,
    AUDIT_RETENTION_DAYS,
    AUDIT_VALUE_TEXT_LIMIT,
    clearAudit,
    countAudit,
    readAudit,
    requireAuditTable,
    resetAuditState,
    USER_ID,
    type AuditRow
} from './t697-audit-harness'
import { makeTaskVO } from '../../persistence-local/__tests__/local-repos-test-helpers'

/**
 * T697 / A 档 M0 —— **AC6 有界（条数 / 保留期 / 单值 512 截断 / 单条 1 KB 预算 / 按实体计数）**
 *
 * 冻结口径（R-5 / AC6 / ADR 决策 5 / T696 §8）：
 * - 每用户 ≤ **1000 条** 且 ≤ **90 天**（先到者淘汰，按压 `[userId+at]` 索引裁切）；
 * - 单值文本 > **512** 字符 ⇒ 截断 + `truncated:true` + `truncatedFields:[字段名]`（复用 journal 口径，⛔ 另造字面量）；
 * - 单条序列化 ≤ **1 KB 字节**（这是「总量 ≤2 MB」成立的前提；超出按字段降级并置 `truncated`）；
 * - 同一次写 **1 条**；批量**按实体计数**（PRD **D4** 收窄口径，⛔ 不按用户手势）。
 *
 * 裁切时机（ADR 决策 5）：追加后单飞异步裁切 + 启动裁切 ⇒ 用例用 `vi.waitFor` 等待，
 * ⛔ 不断言「写返回前已裁切」（那是把不阻塞保存的硬约束改坏）。
 * @see docs/prds/2026-11-10-audit-log.md（R-5 / AC6 / D4）
 * @see docs/reports/T696-audit-log-arch-review.md（§8.1 / §8.2 / §10.1 AC6）
 */

const seedTask = async (overrides: Parameters<typeof makeTaskVO>[0] = {}): Promise<string> => {
    const [task, err] = await newLocalTaskRepository().create(makeTaskVO(overrides))
    expect(err).toBeNull()
    await clearAudit()
    return task!.id
}

const patch = async (id: string, changes: Record<string, unknown>): Promise<void> => {
    const vo = new UpdateTaskValueObject(id)
    for (const [field, value] of Object.entries(changes)) {
        ;(vo as unknown as Record<string, unknown>)[field] = value
    }
    expect(await newLocalTaskRepository().update(id, vo)).toBeNull()
}

/** 直接铺审计行（造「已满 / 已过期」历史；`at` 决定淘汰顺序） */
const seedAuditRows = async (
    count: number,
    at: (index: number) => string,
    startIndex = 0
): Promise<AuditRow[]> => {
    const table = requireAuditTable()
    const rows: AuditRow[] = Array.from({ length: count }, (_, offset) => {
        const index = startIndex + offset
        return {
            userId: USER_ID,
            entity: 'tasks',
            entityId: `seeded-${index}`,
            action: 'update',
            source: 'local-edit',
            fields: [{ field: 'name', from: `seed-${index}`, to: `seed-${index + 1}` }],
            at: at(index)
        }
    })
    await table.bulkAdd(rows as AuditRow[])
    return rows
}

const isoDaysAgo = (days: number, offsetMs = 0): string =>
    new Date(Date.now() - days * 24 * 60 * 60 * 1000 + offsetMs).toISOString()

/** 字节数（UTF-8；「1 KB 预算」按字节而非字符口径） */
const byteLength = (value: unknown): number =>
    new TextEncoder().encode(JSON.stringify(value)).length

describe('T697 / AC6 条数上限：>1000 条 ⇒ 淘汰最旧、总量不超上限', () => {
    beforeEach(resetAuditState)

    it('已有 1000 条 + 1 次真实写 ⇒ 裁到 1000 且最旧那条被淘汰', async () => {
        const id = await seedTask()
        const seeded = await seedAuditRows(AUDIT_LIMIT, (index) => isoDaysAgo(30, index * 1000))
        const oldestEntityId = seeded[0]!.entityId

        await patch(id, { name: 'B1-after-limit' })

        await vi.waitFor(
            async () => {
                expect(
                    await countAudit(),
                    `超过 ${AUDIT_LIMIT} 条必须裁切到上限（环形淘汰最旧）`
                ).toBe(AUDIT_LIMIT)
            },
            { timeout: 5000, interval: 50 }
        )
        const entries = await readAudit()
        expect(entries.map((entry) => entry.entityId)).not.toContain(oldestEntityId)
        // 新写的那条必须在（淘汰的是最旧，不是最新）
        expect(entries.some((entry) => entry.entityId === id)).toBe(true)
    })
})

describe('T697 / AC6 保留期：>90 天 ⇒ 淘汰（与条数界「先到者」生效）', () => {
    beforeEach(resetAuditState)

    it('200 天前的记录被清走、近期记录保留', async () => {
        const id = await seedTask()
        await seedAuditRows(1, () => isoDaysAgo(AUDIT_RETENTION_DAYS + 110))
        await seedAuditRows(1, () => isoDaysAgo(1), 1)

        await patch(id, { name: 'B1-retention' })

        await vi.waitFor(
            async () => {
                const entries = await readAudit()
                expect(
                    entries.map((entry) => entry.entityId),
                    `超过 ${AUDIT_RETENTION_DAYS} 天的记录必须淘汰`
                ).toEqual([`seeded-1`, id])
            },
            { timeout: 5000, interval: 50 }
        )
    })
})

describe('T697 / AC6 体积：单值 >512 截断 / 单条 ≤1 KB 字节预算', () => {
    beforeEach(resetAuditState)

    it('600 字符文本 ⇒ 值截断到 512 + truncated + truncatedFields', async () => {
        const id = await seedTask()
        const longText = 'x'.repeat(600)

        await patch(id, { description: longText })

        const entries = await readAudit()
        expect(entries).toHaveLength(1)
        const diff = entries[0]!.fields.find((item) => item.field === 'description')
        expect(diff).toBeTruthy()
        expect(String(diff!.to)).toHaveLength(AUDIT_VALUE_TEXT_LIMIT)
        expect(entries[0]!.truncated).toBe(true)
        expect(entries[0]!.truncatedFields).toContain('description')
    })

    it('多字段长值（512 截断后仍超预算）⇒ 序列化 ≤1 KB 且置 truncated', async () => {
        const id = await seedTask()
        const longText = 'y'.repeat(600)
        const manyTags = Array.from({ length: 60 }, (_, index) => `tag-${index}-abcdefgh`)

        await patch(id, { description: longText, tags: manyTags })

        const entries = await readAudit()
        expect(entries).toHaveLength(1)
        expect(
            byteLength(entries[0]!),
            `单条必须 ≤ ${AUDIT_ENTRY_BYTE_BUDGET} 字节（AC6 / ⬅「总量 ≤2 MB」前提）`
        ).toBeLessThanOrEqual(AUDIT_ENTRY_BYTE_BUDGET)
        expect(entries[0]!.truncated).toBe(true)
    })
})

describe('T697 / AC6 计数口径：同一次写 1 条 / 批量按实体计数（D4）', () => {
    beforeEach(resetAuditState)

    it('清单归档级联 2 个任务 ⇒ 2 条（每实体 1 条，⛔ 不是 1 条「批量」记录）', async () => {
        const project: ProjectRecord = {
            id: 'project-batch',
            userId: USER_ID,
            name: 'plain:批量清单',
            icon: '',
            description: 'plain:',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            deletedAt: null,
            archivedAt: null,
            deactivedAt: null,
            sortId: 0,
            taskCount: 2
        }
        await localDatabase.projects.put(project)
        const first = await seedTask({ projectId: project.id, name: '批量任务一' })
        const second = await seedTask({ projectId: project.id, name: '批量任务二' })
        await clearAudit()

        const err = await newLocalTaskRepository().archiveByProjectId(project.id)
        expect(err).toBeNull()

        const entries = await readAudit()
        expect(entries).toHaveLength(2)
        expect(entries.map((entry) => entry.entityId).sort()).toEqual([first, second].sort())
        for (const entry of entries) {
            expect(entry).toMatchObject({ entity: 'tasks', action: 'archive' })
            expect(entry.fields).toEqual([])
        }
    })
})