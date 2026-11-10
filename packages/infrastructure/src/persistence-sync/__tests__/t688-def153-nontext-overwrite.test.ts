import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { UpdateTaskValueObject } from '@nao-todo/domain-task'
import type { TaskUpdateOrigin } from '@nao-todo/domain-task'
import { localDatabase } from '../../persistence-local/db/local-database'
import { newLocalTaskRepository } from '../../persistence-local/repos/task-repo-impl'
import { makeTaskVO, setup } from '../../persistence-local/__tests__/local-repos-test-helpers'
import { loadConflictJournal } from '../conflict-journal'

/**
 * T688 / `DEF-153` —— **非文本字段的覆盖记账**（`DEF-146` 同族边界的收口）
 *
 * 口径（PM 冻结）：判据不变 —— `F = keys(载荷) ∩ keys(编辑基准)`，逐字段 `(R≠O) 且 (L≠R)` 才记，
 * 比较一律 `valuesEqual`；本批**只改基准来源**（控件交互起点冻结 `O`，由 presentation 层透传）。
 *
 * 覆盖矩阵（6 字段 × 2 方向）：
 * - **远端改过同字段** + 我保存（值不同）⇒ **恰 1 条**，快照只含该字段；
 * - **远端没动** ⇒ **0 条**（零误报）。
 *
 * 字段：`state` / `priority` / `starMarkAt` / `tags` / `parentTaskId` / `startAt`（日期代表）。
 */

const USER_ID = 't688-user'

const repo = () => newLocalTaskRepository()

/** 造一条已存在任务（清掉 seed 队列项） */
const seed = async (): Promise<string> => {
    const [task, err] = await repo().create(makeTaskVO({ name: '起点标题' }))
    expect(err).toBeNull()
    await localDatabase.syncQueue.clear()
    return task!.id
}

/** 模拟「远端那次修改已由自动刷新落库」（本地写 + 清队列，不模拟 A1 记账） */
const remoteLanding = async (id: string, patch: Record<string, unknown>): Promise<void> => {
    const vo = new UpdateTaskValueObject(id)
    Object.assign(vo, patch)
    expect(await repo().update(id, vo)).toBeNull()
    await localDatabase.syncQueue.clear()
}

const save = async (
    id: string,
    patch: Record<string, unknown>,
    origin: TaskUpdateOrigin
): Promise<void> => {
    const vo = new UpdateTaskValueObject(id)
    Object.assign(vo, patch)
    expect(await repo().update(id, vo, origin)).toBeNull()
}

const journal = () => loadConflictJournal(USER_ID)

interface Case {
    field: string
    /** 交互起点值（= 已持久化值，控件打开那一刻冻结） */
    origin: unknown
    /** 远端改成的值（null = 远端不动） */
    remote: unknown
    /** 我保存的值 */
    local: unknown
}

const CASES: Case[] = [
    { field: 'state', origin: 'todo', remote: 'in_progress', local: 'done' },
    { field: 'priority', origin: 'medium', remote: 'low', local: 'high' },
    {
        field: 'starMarkAt',
        origin: null,
        remote: '2026-02-01T00:00:00.000Z',
        local: '2026-02-02T00:00:00.000Z'
    },
    { field: 'tags', origin: [], remote: ['tag-remote'], local: ['tag-local'] },
    { field: 'parentTaskId', origin: '', remote: 'parent-remote', local: 'parent-local' },
    {
        field: 'startAt',
        origin: '',
        remote: '2026-03-01T00:00:00.000Z',
        local: '2026-03-02T00:00:00.000Z'
    }
]

describe('T688 / DEF-153 非文本字段：远端改过同字段 ⇒ 记 1 条', () => {
    beforeEach(async () => {
        await setup(USER_ID)
    })

    it.each(CASES)('$field：远端改过 + 我保存 ⇒ 1 条且快照只含该字段', async (testCase) => {
        const id = await seed()
        await remoteLanding(id, { [testCase.field]: testCase.remote })
        await save(id, { [testCase.field]: testCase.local }, {
            [testCase.field]: testCase.origin
        } as TaskUpdateOrigin)

        const entries = await journal()
        expect(entries).toHaveLength(1)
        const entry = entries[0]!
        expect(entry.kind).toBe('pull-local-wins')
        expect(Object.keys(entry.loser).sort()).toEqual(['id', testCase.field].sort())
        expect(entry.loser[testCase.field]).toEqual(testCase.remote)
        // 字段级信号（M5 additive）同步落账
        expect(entry.conflictFields).toEqual([testCase.field])
    })
})

describe('T688 / DEF-153 非文本字段：远端没动 ⇒ 0 条（零误报）', () => {
    beforeEach(async () => {
        await setup(USER_ID)
    })

    it.each(CASES)('$field：远端未改 + 我保存 ⇒ 0 条', async (testCase) => {
        const id = await seed()
        await save(id, { [testCase.field]: testCase.local }, {
            [testCase.field]: testCase.origin
        } as TaskUpdateOrigin)

        expect(await journal()).toHaveLength(0)
    })
})