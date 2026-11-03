// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vite-plus/test'
import { CONFLICT_ENTITY_TABLES } from '../conflict-entity-registry'
import { SYNC_TABLES } from '../sync-service'

/**
 * T165 / W3 + T166b —— 冲突实体注册表「单一事实源」一致性守护
 *
 * `SYNC_TABLES` 由 `sync-service.ts` 导出（T166b）⇒ **直接 import** 做集合级断言，
 * 不再源码扫描（消除文本耦合；表名增删/重命名会被断言直接捕获）。
 */

describe('冲突实体注册表 - 单一事实源一致性（T165 / T166b / DEF-132）', () => {
    it('注册表 key 集 ≡ sync-service SYNC_TABLES 表集', () => {
        const expected = SYNC_TABLES.map((config) => config.table)
        expect(expected.length).toBeGreaterThan(0)
        const actual = CONFLICT_ENTITY_TABLES.map((config) => config.table)
        expect([...actual].sort()).toEqual([...expected].sort())
    })

    /**
     * DEF-132：「保留服务端」写回必须与 pull **同一条归一链** ⇒ 同一张表必须用同一批转换器
     * @description `resToEntity` 是新增的第二处映射点（服务端行 → 实体），若与 `SYNC_TABLES` 漂移，
     *              写回会再次出现「pull 能归一、写回不能」的形状缺口（`null` 数组 ⇒ TypeError）。
     */
    it('注册表转换器 ≡ SYNC_TABLES（resToEntity / entityToRecord / recordToEntity 同一函数）', () => {
        for (const config of CONFLICT_ENTITY_TABLES) {
            const synced = SYNC_TABLES.find((candidate) => candidate.table === config.table)
            expect(synced, `缺少同步配置: ${config.table}`).toBeDefined()
            expect(config.resToEntity, `resToEntity 漂移: ${config.table}`).toBe(
                synced!.resToEntity
            )
            expect(config.entityToRecord, `entityToRecord 漂移: ${config.table}`).toBe(
                synced!.entityToRecord
            )
            expect(config.recordToEntity, `recordToEntity 漂移: ${config.table}`).toBe(
                synced!.recordToEntity
            )
        }
    })
})