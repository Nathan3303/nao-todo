// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { appendConflict, loadConflictJournal } from '../conflict-journal'
import { recordEditOverwrite } from '../edit-overwrite'
import {
    FUTURE_REMOTE_TS,
    USER_ID,
    createSyncedTask,
    makeServer,
    makeService,
    patchLocal,
    readJournal,
    resetLocalState
} from './t675-field-merge-harness'

/**
 * T682 / B 批 M5 —— **`conflictFields`（additive 字段级信号）**
 *
 * 口径（ADR D5 / M5 卡）：
 * - 四个边界都要落：pull 远端胜 / pull 本地胜 / push `stale` / DEF-146 保存侧；
 * - ⛔ 不改既有 `kind`、不改既有字段形状，只追加可选 `conflictFields`；
 * - 只含**真正冲突**的字段（不同字段自动合并成功的不入账）；
 * - **提醒组 = 整组四字段**（`conflictFields` 与 `loser` 都不得只含单个字段）；
 * - 缺省（旧条目 / 整行裁决）⇒ 不落键（面板回退整行差异展示）。
 */

const REMIND_GROUP = ['remindAt', 'remindRepeat', 'remindTime', 'remindWeekdays'] as const

describe('T682 / M5 conflictFields：pull 两支', () => {
    beforeEach(resetLocalState)

    it('pull 本地胜 × 同字段冲突 ⇒ conflictFields 只含冲突字段（合并成功的不入列）', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)
        await patchLocal(id, { name: 'B-name', priority: 'high' })
        // 远端更早 ⇒ 本地胜；priority 同字段冲突，description 只对方改（可自动合并）
        server.setRemote(id, { description: 'A-desc', priority: 'low' })

        await makeService(server).pullAll()

        const entries = await readJournal()
        expect(entries).toHaveLength(1)
        expect(entries[0]?.kind).toBe('pull-local-wins')
        expect(entries[0]?.conflictFields).toEqual(['priority'])
        // 败方快照只含冲突字段（合并成功的 description 不入账）
        expect((entries[0]!.loser as Record<string, unknown>).description).toBeUndefined()
    })

    it('pull 远端胜 × 同字段冲突 ⇒ conflictFields 含冲突字段', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)
        await patchLocal(id, { priority: 'high' })
        server.setRemote(id, { priority: 'low' }, FUTURE_REMOTE_TS)

        await makeService(server).pullAll()

        const entries = await readJournal()
        expect(entries).toHaveLength(1)
        expect(entries[0]?.kind).toBe('remote-wins')
        expect(entries[0]?.conflictFields).toEqual(['priority'])
    })
})

describe('T682 / M5 conflictFields：push stale', () => {
    beforeEach(resetLocalState)

    it('stale × 同字段冲突 ⇒ conflictFields 含冲突字段', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server)
        await patchLocal(id, { priority: 'high' })
        server.setRemote(id, { priority: 'low' })

        await makeService(server).pushAll()

        const entries = await readJournal()
        expect(entries).toHaveLength(1)
        expect(entries[0]?.kind).toBe('stale')
        expect(entries[0]?.conflictFields).toEqual(['priority'])
    })
})

describe('T682 / M5 提醒组：整组四字段（⛔ 不得只记单字段）', () => {
    beforeEach(resetLocalState)

    it('组内双方都改 ⇒ conflictFields 与 loser 均含整组四字段', async () => {
        const server = makeServer()
        const id = await createSyncedTask(server, {
            remindRepeat: 'none',
            remindTime: '09:00',
            remindWeekdays: []
        })
        // 我改整组、对方也改整组（值不同）⇒ 整组冲突（不混搭）
        await patchLocal(id, {
            remindRepeat: 'daily',
            remindTime: '08:00',
            remindWeekdays: [1]
        })
        server.setRemote(id, {
            remindRepeat: 'weekly',
            remindTime: '09:00',
            remindWeekdays: [1, 3, 5]
        })

        await makeService(server).pullAll()

        const entries = await readJournal()
        expect(entries).toHaveLength(1)
        const entry = entries[0]!
        // 整组四字段（顺序 = 合并域顺序；用集合断言避免耦合字段顺序）
        expect([...(entry.conflictFields ?? [])].sort()).toEqual([...REMIND_GROUP].sort())
        for (const field of REMIND_GROUP) {
            expect(entry.loser).toHaveProperty(field)
        }
    })
})

describe('T682 / M5 conflictFields：DEF-146 保存侧口径对齐', () => {
    beforeEach(resetLocalState)

    it('保存侧记账 ⇒ conflictFields = 被覆盖字段集', async () => {
        await recordEditOverwrite({
            userId: USER_ID,
            table: 'tasks',
            entityId: 'task-save-side',
            cloud: { name: '云端名', description: '云端描述' },
            fields: ['name'],
            winnerUpdatedAt: '2026-02-01T00:00:00.000Z'
        })

        const entries = await loadConflictJournal(USER_ID)
        expect(entries).toHaveLength(1)
        expect(entries[0]?.kind).toBe('pull-local-wins')
        expect(entries[0]?.conflictFields).toEqual(['name'])
    })
})

describe('T682 / M5 conflictFields：additive 语义（缺省 / 去重）', () => {
    beforeEach(resetLocalState)

    it('未传 conflictFields ⇒ 条目不落该键（旧调用点逐字不变）', async () => {
        await appendConflict(USER_ID, {
            kind: 'push-noop',
            table: 'tasks',
            entityId: 'task-no-fields',
            loser: { id: 'task-no-fields', name: '我的版本' }
        })

        const [entry] = await loadConflictJournal(USER_ID)
        expect(entry).toBeTruthy()
        expect(entry && 'conflictFields' in entry).toBe(false)
    })

    it('重复字段 ⇒ 去重（保持传入顺序）', async () => {
        await appendConflict(USER_ID, {
            kind: 'stale',
            table: 'tasks',
            entityId: 'task-dedupe',
            loser: { id: 'task-dedupe', name: '我的版本' },
            conflictFields: ['priority', 'name', 'priority']
        })

        const [entry] = await loadConflictJournal(USER_ID)
        expect(entry?.conflictFields).toEqual(['priority', 'name'])
    })
})