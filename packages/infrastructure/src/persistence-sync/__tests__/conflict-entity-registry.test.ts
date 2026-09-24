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

describe('冲突实体注册表 - 单一事实源一致性（T165 / T166b）', () => {
    it('注册表 key 集 ≡ sync-service SYNC_TABLES 表集', () => {
        const expected = SYNC_TABLES.map((config) => config.table)
        expect(expected.length).toBeGreaterThan(0)
        const actual = CONFLICT_ENTITY_TABLES.map((config) => config.table)
        expect([...actual].sort()).toEqual([...expected].sort())
    })
})