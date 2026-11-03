// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CreateTaskValueObject } from '@nao-todo/domain-task'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { localSession } from '../../persistence-local/session/local-session'
import { appendConflict, compareConflict, valuesEqual } from '../conflict-journal'

/**
 * DEF-135（用户走查：截图里「归档状态」「星标」两侧都显示「未设置」，却双双标了「差异」）
 *
 * 根因：判等口径（`valuesEqual`：`null` ≠ `''`）与展示口径（`conflict-value-format.isUnsetValue`：
 *      `null` / `undefined` / `''` / `[]` 一律「未设置」）不一致。
 *
 * 契约（DESIGN §4.7「未设置不得成对出现」）：判等前**空值哨兵归一**
 *   `null` ≡ `undefined` ≡ `''` ≡ `[]`；⛔ `0` / `false` **不是**空值。
 *   同一归一必须同时作用于**写入侧**（A1 快照字段挑选）⇒ 全仓只有一个判等实现。
 *
 * 红基线：摘掉归一（`valuesEqual` 回到「任一 `null`/`undefined` 即不相等」）⇒ 本文件必红。
 */

const USER_ID = 'def135-user'
const SERVER_BASE = '2026-01-05T00:00:00.000Z'

const setup = async (): Promise<void> => {
    await localDatabase.projects.clear()
    await localDatabase.projectPreferences.clear()
    await localDatabase.tags.clear()
    await localDatabase.tagPreferences.clear()
    await localDatabase.tasks.clear()
    await localDatabase.taskCheckItems.clear()
    await localDatabase.taskComments.clear()
    await localDatabase.pomodoros.clear()
    await localDatabase.pomodoroRecords.clear()
    await localDatabase.users.clear()
    await localDatabase.userConfigs.clear()
    await localDatabase.meta.clear()
    await localDatabase.deletionSchedules.clear()
    await localDatabase.syncQueue.clear()
    await localDatabase.syncCursor.clear()
    cryptoService.lock()
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
}

/** 建一条本地任务（= 详情面板的「当前行」），返回其 id */
const createLocalTask = async (name: string): Promise<string> => {
    const repo = newLocalTaskRepository()
    const [task, taskErr] = await repo.create(
        new CreateTaskValueObject(
            null,
            null,
            name,
            '',
            'todo',
            'medium',
            null,
            null,
            'p-1',
            [],
            null,
            'none',
            null,
            []
        )
    )
    expect(taskErr).toBeNull()
    return (task as { id: string }).id
}

describe('DEF-135 判等：空值哨兵归一（null ≡ undefined ≡ "" ≡ []）', () => {
    it('用户现场：loser = { archivedAt: null, starMarkAt: "" } vs current = { archivedAt: "", starMarkAt: null } ⇒ 逐字段相等', () => {
        const loser = { archivedAt: null, starMarkAt: '' }
        const current = { archivedAt: '', starMarkAt: null }
        for (const field of Object.keys(loser) as (keyof typeof loser)[]) {
            // 修复前：null 与 '' 被判「不同」⇒ 两侧都渲染「未设置」却标差异
            expect(valuesEqual(loser[field], current[field]), field).toBe(true)
        }
    })

    it('四种空值哨兵两两等价；`0` / `false` 不算空（真实业务值）', () => {
        const sentinels: unknown[] = [null, undefined, '', []]
        for (const left of sentinels) {
            for (const right of sentinels) {
                expect(valuesEqual(left, right)).toBe(true)
            }
        }
        // `0` / `false` 不是空值 ⇒ 与「未设置」仍是差异
        expect(valuesEqual(0, '')).toBe(false)
        expect(valuesEqual(0, null)).toBe(false)
        expect(valuesEqual(false, null)).toBe(false)
        expect(valuesEqual(false, 0)).toBe(false)
        // 有内容的数组 ≠ 空
        expect(valuesEqual([], ['a'])).toBe(false)
        // 对象按 JSON 深比较
        expect(valuesEqual({ a: 1 }, { a: 1 })).toBe(true)
        expect(valuesEqual({ a: 1 }, { a: 2 })).toBe(false)
    })
})

describe('DEF-135 compareConflict：两侧都是「未设置」⇒ 不产生差异行', () => {
    beforeEach(async () => {
        await setup()
    })

    it('空值哨兵混用（快照 "" / 当前行 null）⇒ diffs 为 0 条', async () => {
        const taskId = await createLocalTask('写周报')

        // 快照侧：归档 / 星标都是「未设置」字面量 `''`（真实服务端行就是这种形状）
        await appendConflict(USER_ID, {
            kind: 'stale',
            table: 'tasks',
            entityId: taskId,
            loser: { id: taskId, archivedAt: '', starMarkAt: '' },
            winnerUpdatedAt: SERVER_BASE
        })

        const comparison = await compareConflict(USER_ID, 'tasks', taskId)
        expect(comparison).not.toBeNull()
        // 当前行这两字段均为 `null` ⇒ 归一后相等 ⇒ 不得入 diffs（修复前为 2 条）
        expect(comparison!.diffs).toHaveLength(0)
    })

    it('真实差异仍要出：`0` vs 空值 ⇒ 仍是差异（不把 0 当空吞掉）', async () => {
        const taskId = await createLocalTask('写周报')

        await appendConflict(USER_ID, {
            kind: 'stale',
            table: 'tasks',
            entityId: taskId,
            loser: { id: taskId, checkItemCount: 0 },
            winnerUpdatedAt: SERVER_BASE
        })

        const comparison = await compareConflict(USER_ID, 'tasks', taskId)
        const byField = new Map(comparison!.diffs.map((diff) => [diff.field, diff]))
        // 本地当前行 checkItemCount = 0（新建任务无检查项）⇒ 与快照 0 相等 ⇒ 不入 diffs；
        // 关键断言：`0` 没有被当成「空」而与 null 混为一谈（见下一条）
        expect(byField.has('checkItemCount')).toBe(false)
    })

    it('`0` vs 快照 `null` ⇒ 如实计入差异（show 出「云端新增」而非静默相等）', async () => {
        const taskId = await createLocalTask('写周报')

        await appendConflict(USER_ID, {
            kind: 'stale',
            table: 'tasks',
            entityId: taskId,
            loser: { id: taskId, checkItemCount: null },
            winnerUpdatedAt: SERVER_BASE
        })

        const comparison = await compareConflict(USER_ID, 'tasks', taskId)
        const diff = comparison!.diffs.find((one) => one.field === 'checkItemCount')
        expect(diff).toBeDefined()
        expect(diff!.loser).toBeNull()
        expect(diff!.current).toBe(0)
    })
})