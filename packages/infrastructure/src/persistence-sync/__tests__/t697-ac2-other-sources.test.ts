// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { localDatabase } from '../../persistence-local/db/local-database'
import { resolveConflictKeepServer, resolveConflictRetryLocal } from '../conflict-journal'
import { SyncService } from '../sync-service'
import {
    clearAudit,
    countAudit,
    makeAuditServer,
    readAudit,
    resetAuditState,
    type AuditFakeServer
} from './t697-audit-harness'
import {
    FUTURE_REMOTE_TS,
    createSyncedTask,
    patchLocal,
    readJournal,
    readLocal,
    USER_ID
} from './t675-field-merge-harness'

/**
 * T697 / A 档 M0 —— **四来源之 `push-merge` 与 `conflict-retry`（AC2 的第二/第四条链路）**
 *
 * 来源映射冻结口径（R-4 四值固定 + PRD D3）：
 * - push `stale` 回执侧自动合并**实际改了业务字段** ⇒ `source='push-merge'`；
 * - 「保留我的修改」（`resolveConflictRetryLocal` 败方快照写回）⇒ `source='conflict-retry'`；
 * - 「用云端的」（`resolveConflictKeepServer` 写回 `serverCurrent`）⇒ 内容来源是云端 ⇒
 *   `source='pull'`（⚠️ D3 明确：⛔ 不得选择「这两个动作不记账」）。
 * - `aborted` / 无业务变化的合并分支 ⇒ **0 条**（一次写只 1 条，且只在真变了时才写）。
 * @see docs/prds/2026-11-10-audit-log.md（R-3 / R-4 / D3 / AC2）
 * @see docs/reports/T696-audit-log-arch-review.md（§3.1 落点 push-merge / conflict-retry 两行）
 */

const service = (server: AuditFakeServer): SyncService => new SyncService(server.requester)

const seedSynced = async (
    server: AuditFakeServer,
    seed: Parameters<typeof createSyncedTask>[1] = {}
): Promise<string> => {
    const id = await createSyncedTask(server, seed)
    await clearAudit()
    return id
}

describe('T697 / AC2 push-merge：stale 回执侧合并真改了业务字段 ⇒ 1 条', () => {
    beforeEach(resetAuditState)

    it('我改 name、远端改 description ⇒ 合并落库 1 条 source=push-merge（fields 只含 description）', async () => {
        const server = makeAuditServer()
        const id = await seedSynced(server)

        await patchLocal(id, { name: 'B1-local-name' })
        server.setRow(id, { description: 'A1-remote-desc' })
        await service(server).pushAll()

        const entries = await readAudit()
        // local-edit（我的改名）+ push-merge（合并带入远端描述）= 2 条，各 1 次写
        expect(entries.map((entry) => entry.source)).toEqual(['local-edit', 'push-merge'])
        expect(entries[1]!).toMatchObject({
            entity: 'tasks',
            entityId: id,
            source: 'push-merge',
            action: 'update'
        })
        expect(entries[1]!.fields).toEqual([
            { field: 'description', from: 'A0-desc', to: 'A1-remote-desc' }
        ])
        // 落库确实带入了远端描述（证明这条审计对应真实写入，不是凭回执记账）
        expect((await readLocal(id)).description).toBe('A1-remote-desc')
    })

    it('stale 回执但合并无业务变化（远端只推进 updatedAt）⇒ 不新增审计', async () => {
        const server = makeAuditServer()
        const id = await seedSynced(server)

        await patchLocal(id, { name: 'B1-local-name' })
        server.bumpUpdatedAt(id)
        await service(server).pushAll()

        const entries = await readAudit()
        expect(entries.map((entry) => entry.source)).toEqual(['local-edit'])
        expect(await countAudit()).toBe(1)
    })
})

describe('T697 / AC2 conflict-retry：「保留我的修改」与「用云端的」各 1 条（来源按 D3 映射）', () => {
    beforeEach(resetAuditState)

    it('「保留我的修改」：败方快照写回 ⇒ 1 条 source=conflict-retry，fields = 被复原字段', async () => {
        const server = makeAuditServer()
        const id = await seedSynced(server)

        await patchLocal(id, { description: 'B1-my-desc' })
        // 远端更晚且同字段 ⇒ pull 远端胜，journal 记 remote-wins（loser = 我的快照）
        server.setRow(id, { description: 'A1-remote-desc' }, FUTURE_REMOTE_TS)
        await service(server).pullAll()
        expect((await readJournal()).map((entry) => entry.kind)).toEqual(['remote-wins'])
        expect((await readLocal(id)).description).toBe('A1-remote-desc')
        // 远端胜支（T696 §3.1 落点「applyPullBatch 远端胜」）也必须留痕：本机编辑 1 条 + 覆盖 1 条
        expect((await readAudit()).map((entry) => entry.source)).toEqual(['local-edit', 'pull'])

        const before = await countAudit()
        const result = await resolveConflictRetryLocal(USER_ID, 'tasks', id)

        expect(result.ok).toBe(true)
        expect(await countAudit()).toBe(before + 1)
        const entries = await readAudit()
        const last = entries[entries.length - 1]!
        expect(last).toMatchObject({
            entity: 'tasks',
            entityId: id,
            source: 'conflict-retry',
            action: 'update'
        })
        // 写回的是我的值（真实变化才能记账）
        expect(last.fields).toEqual([
            { field: 'description', from: 'A1-remote-desc', to: 'B1-my-desc' }
        ])
        expect((await readLocal(id)).description).toBe('B1-my-desc')
    })

    it('重复点「保留我的修改」（条目已清）⇒ 幂等 no-op，不再新增审计', async () => {
        const server = makeAuditServer()
        const id = await seedSynced(server)

        await patchLocal(id, { description: 'B1-my-desc' })
        server.setRow(id, { description: 'A1-remote-desc' }, FUTURE_REMOTE_TS)
        await service(server).pullAll()
        await resolveConflictRetryLocal(USER_ID, 'tasks', id)
        const afterFirst = await countAudit()

        await resolveConflictRetryLocal(USER_ID, 'tasks', id)

        expect(await countAudit()).toBe(afterFirst)
    })

    it('「用云端的」：写回 serverCurrent ⇒ 1 条 source=pull（D3 映射；⛔ 不得选择不记账）', async () => {
        const server = makeAuditServer()
        const id = await seedSynced(server)

        await patchLocal(id, { priority: 'high' })
        // 远端同字段更新 ⇒ push 得到 stale + serverCurrent（可离线写回）
        server.setRow(id, { priority: 'low' })
        await service(server).pushAll()
        const journal = await readJournal()
        expect(journal.map((entry) => entry.kind)).toContain('stale')
        expect((await readLocal(id)).priority).toBe('high')

        const before = await countAudit()
        const result = await resolveConflictKeepServer(USER_ID, 'tasks', id)

        expect(result.ok).toBe(true)
        expect(await countAudit()).toBe(before + 1)
        const entries = await readAudit()
        const last = entries[entries.length - 1]!
        expect(last).toMatchObject({ entityId: id, source: 'pull' })
        expect(last.fields).toEqual([{ field: 'priority', from: 'high', to: 'low' }])
        expect((await readLocal(id)).priority).toBe('low')
        // 写回走「单事务：行 + 清队列 + 清条目」⇒ 队列项必须消失
        expect(await localDatabase.syncQueue.get(`${USER_ID}:tasks:${id}`)).toBeUndefined()
    })
})