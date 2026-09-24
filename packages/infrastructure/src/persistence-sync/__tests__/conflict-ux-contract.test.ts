// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import { CONFLICT_JOURNAL_LIMIT, appendConflict, loadConflictJournal } from '../conflict-journal'

/**
 * T162 用例先行（红基线）—— 阶段二 2B · 面 ③ 冲突 journal（数据面契约）
 *
 * 契约（ADR §9.2.4 / §9.6 R-15 / DP-2B-5）：
 * - journal 上限 **50 → 200**（`CONFLICT_JOURNAL_LIMIT`）；
 * - 淘汰最旧时须有**可见折叠提示**（UX 面，属 T165；本文件仅覆盖数据面「上限 + 有界」）；
 * - 列表/只读对比的数据源 = journal 条目（`table` / `entityId` / `loser` 快照 / `winnerUpdatedAt`）。
 *
 * ⚠️ **未覆盖（缺 API，回报 PM）**：两种恢复动作（「保留服务端」= 删除单条 journal、
 *   「以我的版本重试」= loser 写回本地 + `markDirty`）需 T165 给出模块/函数面；
 *   当前无任何已存在导出可承载 ⇒ 不在本文件臆造 API（避免 `vp check` 类型错误）。
 *
 * **红窗口**：上限 = 200 及 200 条边界预期**红**（T164/T165 落地后转绿）；对比数据源现状已绿。
 */

const USER_ID = 'conflict-ux-user'

const setup = async (): Promise<void> => {
    await localDatabase.meta.clear()
    await localDatabase.syncQueue.clear()
    cryptoService.lock()
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'test-password')
}

describe('面 ③ 冲突 journal - 上限（DP-2B-5）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('CONFLICT_JOURNAL_LIMIT = 200（DP-2B-5：50 → 200 + 折叠提示）', () => {
        expect(CONFLICT_JOURNAL_LIMIT).toBe(200)
    })

    it('有界按新上限：写满 200 条仍全量保留（最旧不被淘汰）', async () => {
        const TOTAL = 200
        for (let i = 0; i < TOTAL; i += 1) {
            await appendConflict(USER_ID, {
                kind: 'remote-wins',
                table: 'tasks',
                entityId: `t-${i}`,
                loser: { id: `t-${i}` }
            })
        }

        const entries = await loadConflictJournal(USER_ID)
        expect(entries).toHaveLength(TOTAL)
        expect(entries[0]!.entityId).toBe('t-0')
        expect(entries.at(-1)!.entityId).toBe(`t-${TOTAL - 1}`)
    })
})

describe('面 ③ 冲突 journal - 只读对比数据源（现状已绿）', () => {
    beforeEach(async () => {
        await setup()
    })

    it('败方快照 vs 当前行所需字段齐备（table / entityId / loser / winnerUpdatedAt / at）', async () => {
        await appendConflict(USER_ID, {
            kind: 'remote-wins',
            table: 'tasks',
            entityId: 't-compare',
            loser: { id: 't-compare', name: '我的本地版本' },
            winnerUpdatedAt: '2026-01-03T00:00:00.000Z',
            loserUpdatedAt: '2026-01-02T00:00:00.000Z'
        })

        const [entry] = await loadConflictJournal(USER_ID)
        expect(entry).toMatchObject({
            table: 'tasks',
            entityId: 't-compare',
            winnerUpdatedAt: '2026-01-03T00:00:00.000Z',
            loserUpdatedAt: '2026-01-02T00:00:00.000Z'
        })
        expect((entry!.loser as Record<string, unknown>).name).toBe('我的本地版本')
        expect(typeof entry!.at).toBe('string')
    })
})