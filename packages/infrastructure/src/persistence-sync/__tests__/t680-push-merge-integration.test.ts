// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { localDatabase } from '../../persistence-local/db/local-database'
import { appendConflict, resolveConflictRetryLocal } from '../conflict-journal'
import {
    USER_ID,
    countQueue,
    createSyncedTask,
    makeServer,
    makeService,
    patchLocal,
    readJournal,
    readLocal,
    resetLocalState
} from './t675-field-merge-harness'

/**
 * T680 / B 批 M4 —— **push `stale` 回执侧合并 + 两条加固**
 *
 * 口径（ADR「M4 必守不变量」/ `679b` §5）：
 * - `stale` + `serverCurrent` + tasks/upsert + 有 `fieldBase` ⇒ 回执侧就地合并：
 *   **0 记账**（无同字段冲突）· **保队列** · base 前进到 `serverUpdatedAt` · 下一轮 push 收敛（AC4）；
 * - 同字段冲突 ⇒ 记 1 条既有 `stale`（loser = 我的整行 + `serverCurrent`），冲突字段取**本地**（显式 winner）；
 * - **不变量（来源：679b 判据 5（augment 第二前提））**：合并后队列项 `fieldBase` 键集 = **完整合并域**
 *   （= `entityToPush` 键集 − 忽略集 − 墓碑），防「partial base + 漏捕写 + 重试」静默取远端；
 * - 墓碑 / 删除动作 / 缺 `serverCurrent` ⇒ **不合并**，逐字走今日 `stale` 分支；
 * - 漏捕写点 `resolveConflictRetryLocal` 已闭合：重试写入携带**写前旧实体**算出的 `fieldBase`。
 *
 * ⚠️ 记账面的 `conflictFields` 属 M5（additive），本文件**不**断言它。
 */

/** `tasks` 的完整合并域（= `entityToPush` 键集 − 忽略集 − `deletedAt`；17 键） */
const TASK_MERGE_DOMAIN = [
    'archivedAt',
    'createdAt',
    'description',
    'endAt',
    'givenUpAt',
    'name',
    'parentTaskId',
    'priority',
    'projectId',
    'remindAt',
    'remindRepeat',
    'remindTime',
    'remindWeekdays',
    'starMarkAt',
    'startAt',
    'state',
    'tags'
].sort()

const queuedRow = (id: string) => localDatabase.syncQueue.get(`${USER_ID}:tasks:${id}`)

const rawRow = (id: string) => localDatabase.tasks.get(id)

describe('T680 / M4 stale 无重叠 ⇒ 0 记账 + 保队列 + base 前进 + 基准退役', () => {
    beforeEach(resetLocalState)

    it('合并后 fieldBase 键集 = 完整合并域（不变量；679b 判据 5 第二前提）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        server.setRemote(id, { description: 'A-desc' })
        await patchLocal(id, { name: 'B-name' })
        await makeService(server).pushAll()

        // 无同字段冲突 ⇒ 0 记账、保队列（下一轮 push 收敛）
        expect(await readJournal()).toHaveLength(0)
        expect(await countQueue()).toBe(1)
        const local = await readLocal(id)
        expect(local.name).toBe('B-name')
        expect(local.description).toBe('A-desc')
        // base 前进到回执里的服务端当前版本（R-6 只前进）
        expect((await rawRow(id))?.syncedServerUpdatedAt).toBe(server.row(id)?.updatedAt)
        // 不变量：fieldBase = 完整合并域（含我未改的字段与四个提醒字段）
        const fieldBase = (await queuedRow(id))?.fieldBase
        expect(Object.keys(fieldBase ?? {}).sort()).toEqual(TASK_MERGE_DOMAIN)
        for (const field of ['remindAt', 'remindRepeat', 'remindTime', 'remindWeekdays']) {
            expect(fieldBase).toHaveProperty(field)
        }
    })
})

describe('T680 / M4 stale 同字段冲突 ⇒ 1 条 stale + 落库取本地值', () => {
    beforeEach(resetLocalState)

    it('显式 lwwWinner=local（不依赖默认值）⇒ 本地值保留、队列保留、基准仍退役为完整域', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        await patchLocal(id, { priority: 'high' })
        server.setRemote(id, { priority: 'low' })
        await makeService(server).pushAll()

        const entries = await readJournal()
        expect(entries.map((entry) => String(entry.kind))).toEqual(['stale'])
        const entry = entries[0]!
        // 既有 stale 形状：败方 = 我的整行 + serverCurrent
        expect((entry.loser as Record<string, unknown>).priority).toBe('high')
        expect(entry.serverCurrent).toBeTruthy()
        expect((await readLocal(id)).priority).toBe('high')
        expect(await countQueue()).toBe(1)
        expect((await rawRow(id))?.syncedServerUpdatedAt).toBe(server.row(id)?.updatedAt)
        expect(Object.keys((await queuedRow(id))?.fieldBase ?? {}).sort()).toEqual(
            TASK_MERGE_DOMAIN
        )
    })
})

describe('T680 / M4 墓碑与今日分支（不合并）', () => {
    beforeEach(resetLocalState)

    it('serverCurrent 为墓碑 ⇒ 不合并：今日 stale（记账 + 出队），本地行不被字段合并改动', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)

        await patchLocal(id, { name: 'B-name' })
        server.setRemote(id, { deletedAt: '2026-02-02T00:00:00.000Z' })
        await makeService(server).pushAll()

        expect((await readJournal()).map((entry) => String(entry.kind))).toEqual(['stale'])
        expect(await countQueue()).toBe(0)
        expect((await readLocal(id)).name).toBe('B-name')
    })
})

describe('T680 / M4 漏捕写点闭合：resolveConflictRetryLocal 携带 fieldBase', () => {
    beforeEach(resetLocalState)

    it('重试写入用写前旧实体算基准（`fieldBase` = 被重试覆盖的字段旧值）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)
        // 模拟「今日分支已出队」的入口状态：队列为空，只剩 journal 条目
        await localDatabase.syncQueue.clear()
        const current = await readLocal(id)
        await appendConflict(USER_ID, {
            kind: 'stale',
            table: 'tasks',
            entityId: id,
            // loser = 我的整行（真实链路形状；name/description 与当前本地行不同）
            loser: Object.assign({}, current, {
                name: 'B-name',
                description: 'B-desc'
            }) as unknown as Record<string, unknown>,
            loserUpdatedAt: '2026-02-01T00:10:00.000Z'
        })

        const result = await resolveConflictRetryLocal(USER_ID, 'tasks', id)

        expect(result.ok).toBe(true)
        const queued = await queuedRow(id)
        expect(queued).toBeTruthy()
        // 写前旧实体（A0-name / A0-desc）作为基准 ⇒ 合并侧不会把它当「我未改」
        expect(queued?.fieldBase).toMatchObject({ name: 'A0-name', description: 'A0-desc' })
        // 重试写入的业务值生效
        const after = await readLocal(id)
        expect(after.name).toBe('B-name')
        expect(after.description).toBe('B-desc')
    })
})