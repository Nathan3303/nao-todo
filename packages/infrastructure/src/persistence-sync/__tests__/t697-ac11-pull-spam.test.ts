// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { localDatabase } from '../../persistence-local/db/local-database'
import { syncTracker } from '../sync-tracker'
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
    readLocalRaw,
    USER_ID
} from './t675-field-merge-harness'

/**
 * T697 / A 档 M0 —— **AC11 防假刷屏（本档最重要）+ AC2（pull 来源）+ AC18（at 不受远端时钟）+ AC17（值形状）**
 *
 * 两个**必须分别成例**的假刷屏来源（PM T697 指令 / PRD R-9 / T696 §4.1）：
 * - **① `DEF-147`（相同记录重放）**：每轮 pull 从 `cursor-1s` 回拉、`applyPullBatch` 在「本地未改」
 *   分支**无条件 `put`** ⇒ 若按「调用了一次 put」记账，每 30s 一轮会持续产出空审计。
 *   用例须**同时**断言「put 仍发生」（证明该缺陷仍在、没有被顺手改掉）**且**「审计 0 条」。
 * - **② `DEF-159` 收集箱桶（记录不同、业务等价）**：本地 `projectId='inbox'` ↔ 服务端隐式桶
 *   `projectId=userId`；`valuesEqual('inbox', '<userId>') === false` ⇒ 未做 `toLocalProjectId` 归一
 *   时每轮 1 条假 `projectId` 变更。**记录层预筛挡不住它**（记录确实不同）⇒ 必须实体层归一后再比。
 *
 * 判据口径（R-1 / R-2 / R-9）：
 * - 判据 = `pickChangedFields(落库前实体, 落库后实体)` 非空（⛔ 不按 put 计数）；
 * - `at` = 写审计时的本机校准时间（⛔ 不取行的 `updatedAt`：远端时间会漂）；
 * - `from`/`to` = 实体明文（⛔ 不是记录层 `plain:` 形状，`T676` 教训）。
 * @see docs/prds/2026-11-10-audit-log.md（AC2 / AC11 / R-9）
 * @see docs/reports/T696-audit-log-arch-review.md（§4.1 / §4.2 / §4.3 / §5 / §10.1 AC2/AC18）
 */

const service = (server: AuditFakeServer): SyncService => new SyncService(server.requester)

/** 建「已同步任务」并清掉 `create` 产生的审计（夹具噪声） */
const seedSynced = async (
    server: AuditFakeServer,
    seed: Parameters<typeof createSyncedTask>[1] = {}
): Promise<string> => {
    const id = await createSyncedTask(server, seed)
    await clearAudit()
    return id
}

describe('T697 / AC11-① DEF-147：内容未变化连续 pull 3 轮 ⇒ 0 条（且 put 仍在发生）', () => {
    beforeEach(resetAuditState)

    it('同一记录被回拉窗口重放 3 轮 ⇒ 每轮 put≥1 但审计恒 0（⛔ 不得按 put 计数）', async () => {
        const server = makeAuditServer()
        const id = await seedSynced(server)
        // 模拟 DEF-147：服务端每轮都返回该行（游标回拉窗口内）
        server.replay = true
        const putSpy = vi.spyOn(localDatabase.tasks, 'put')

        for (let round = 1; round <= 3; round += 1) {
            putSpy.mockClear()
            await service(server).pullAll()

            // ① 写行为不变（本档 ⛔ 不动 DEF-147 的写行为；也证明用例真的走到了「重写」路径）
            expect(
                putSpy.mock.calls.length,
                `第 ${round} 轮应仍发生 tasks.put（DEF-147 现状：无条件 put）`
            ).toBeGreaterThanOrEqual(1)
            // ② 审计必须为 0：判据是「落库前后是否真的变了」，不是「调用了一次 put」
            expect(await countAudit(), `第 ${round} 轮内容未变，不得产生审计记录`).toBe(0)
        }
        expect(String((await readLocalRaw(id)).id)).toBe(id)
    })

    it('服务端只推进 updatedAt（业务内容不变）3 轮 ⇒ 仍 0 条（记录层预筛挡不住时实体层精筛兜底）', async () => {
        const server = makeAuditServer()
        const id = await seedSynced(server)
        server.replay = true

        for (let round = 1; round <= 3; round += 1) {
            server.bumpUpdatedAt(id)
            await service(server).pullAll()
            expect(
                await countAudit(),
                `第 ${round} 轮仅 updatedAt 变化（忽略字段），不得产生审计记录`
            ).toBe(0)
        }
    })
})

describe('T697 / AC11-② DEF-159：收集箱桶归一 ⇒ 内容未变化连续 pull 3 轮 ⇒ 0 条', () => {
    beforeEach(resetAuditState)

    it('本地 inbox ↔ 服务端 userId：3 轮 0 条（漏归一 ⇒ 每轮 1 条假 projectId 变更）', async () => {
        const server = makeAuditServer()
        const id = await seedSynced(server, { projectId: 'inbox' })
        // 夹具自检：服务端确实用隐式桶承载收集箱（否则本用例测不到归一）
        expect(String(server.row(id)?.projectId)).toBe(USER_ID)
        expect(String((await readLocalRaw(id)).projectId)).toBe('inbox')
        server.replay = true

        for (let round = 1; round <= 3; round += 1) {
            await service(server).pullAll()
            expect(
                await countAudit(),
                `第 ${round} 轮：收集箱桶映射不是业务变更（R-9 归一），不得产生审计记录`
            ).toBe(0)
            // 归一后本地仍是字面 inbox（不得被服务端桶值污染）
            expect(String((await readLocalRaw(id)).projectId)).toBe('inbox')
        }
    })

    it('普通清单任务（projectId 两边一致）连续 pull 3 轮 ⇒ 0 条（对照例，排除「一律不记」的假绿）', async () => {
        const server = makeAuditServer()
        const id = await seedSynced(server, { projectId: 'project-1' })
        server.replay = true

        for (let round = 1; round <= 3; round += 1) {
            await service(server).pullAll()
            expect(await countAudit()).toBe(0)
        }
        expect(String((await readLocalRaw(id)).projectId)).toBe('project-1')
    })
})

describe('T697 / AC2 pull 来源：真实变更 ⇒ 1 条 + 字段级 diff + 不与本机编辑混记', () => {
    beforeEach(resetAuditState)

    it('远端改 1 个字段 ⇒ 恰 1 条 source=pull，fields 恰含 description（值 = 明文）', async () => {
        const server = makeAuditServer()
        const id = await seedSynced(server)

        server.setRow(id, { description: 'A1-remote-desc' })
        await service(server).pullAll()

        const entries = await readAudit()
        expect(entries).toHaveLength(1)
        const entry = entries[0]!
        expect(entry).toMatchObject({
            entity: 'tasks',
            entityId: id,
            source: 'pull',
            action: 'update'
        })
        expect(entry.fields).toEqual([
            { field: 'description', from: 'A0-desc', to: 'A1-remote-desc' }
        ])
        // 忽略字段（updatedAt / syncedServerUpdatedAt / projectId 未变）不得出现
        expect(entry.fields.map((diff) => diff.field)).not.toContain('updatedAt')
        expect(entry.fields.map((diff) => diff.field)).not.toContain('syncedServerUpdatedAt')
        // AC17 值形状：实体明文（⛔ 不得出现记录层前缀）
        expect(JSON.stringify(entry)).not.toContain('plain:')
    })

    it('本机编辑后同步 + 远端另改一字段 ⇒ 两条分别记 source（⛔ 不混成 1 条）', async () => {
        const server = makeAuditServer()
        const id = await seedSynced(server)

        await patchLocal(id, { name: 'B1-local-name' })
        await service(server).pushAll()
        expect((await readAudit()).map((entry) => entry.source)).toEqual(['local-edit'])
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)

        server.setRow(id, { priority: 'high' })
        await service(server).pullAll()

        const entries = await readAudit()
        expect(entries).toHaveLength(2)
        expect(entries.map((entry) => entry.source)).toEqual(['local-edit', 'pull'])
        expect(entries[1]!.fields).toEqual([{ field: 'priority', from: 'medium', to: 'high' }])
    })

    it("空哨兵跨断层：本地 startAt='' ↔ 远端 null ⇒ 0 条（valuesEqual 归一，`!==` 会误判）", async () => {
        const server = makeAuditServer()
        const id = await seedSynced(server)

        server.setRow(id, { startAt: null })
        await service(server).pullAll()

        expect(await countAudit()).toBe(0)
    })

    it('pull 字段级合并分支（有队列 + 我改了 A、远端改了 B）⇒ 1 条 source=pull 且只含远端那个字段', async () => {
        const server = makeAuditServer()
        const id = await seedSynced(server)

        // 本地改了 name（入队 + 有 fieldBase），远端只改 description ⇒ 走 applyPullFieldMerge
        await patchLocal(id, { name: 'B1-my-name' })
        server.setRow(id, { description: 'A1-merged-desc' })
        await service(server).pullAll()

        const entries = await readAudit()
        expect(entries.map((entry) => entry.source)).toEqual(['local-edit', 'pull'])
        expect(entries[1]!.fields).toEqual([
            { field: 'description', from: 'A0-desc', to: 'A1-merged-desc' }
        ])
        // 合并结果：我的 name 保留 + 远端 description 落地
        expect((await readLocalRaw(id)).description).not.toBe('A0-desc')
    })

    it('远端墓碑（pull 墓碑支）⇒ 1 条 source=pull action=delete，fields 为空（AC7 墓碑无字段噪声）', async () => {
        const server = makeAuditServer()
        const id = await seedSynced(server)

        await patchLocal(id, { name: 'B1-name-before-tombstone' })
        server.setRow(id, { deletedAt: new Date().toISOString() }, FUTURE_REMOTE_TS)
        await service(server).pullAll()

        const entries = await readAudit()
        const pullEntry = entries.find((entry) => entry.source === 'pull')
        expect(pullEntry, '远端墓碑必须留痕').toBeTruthy()
        expect(pullEntry!.action).toBe('delete')
        expect(pullEntry!.entityId).toBe(id)
        expect(pullEntry!.fields).toEqual([])
    })

    it('AC18：远端 updatedAt 在未来 1 小时 ⇒ 审计 at 仍是本机时间（落在 ±5s 内）', async () => {
        const server = makeAuditServer()
        const id = await seedSynced(server)

        server.setRow(
            id,
            { description: 'A1-clock-desc' },
            new Date(Date.now() + 60 * 60 * 1000).toISOString()
        )
        await service(server).pullAll()

        const entries = await readAudit()
        expect(entries).toHaveLength(1)
        const at = Date.parse(entries[0]!.at)
        expect(Number.isFinite(at)).toBe(true)
        expect(Math.abs(at - Date.now()), '`at` 不得取行时间（远端时钟会漂）').toBeLessThan(5000)
    })
})