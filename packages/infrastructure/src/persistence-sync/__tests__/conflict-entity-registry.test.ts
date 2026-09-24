/// <reference types="vite/client" />
// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vite-plus/test'
import { CONFLICT_ENTITY_TABLES } from '../conflict-entity-registry'

/**
 * T165 / W3 —— 冲突实体注册表「单一事实源」一致性守护
 *
 * `SYNC_TABLES` 定义在 `sync-service.ts`（未导出；该文件属 T166 在制，不得改）。
 * 注册表独立维护「表名 → 本地表/转换器」映射 ⇒ 用**源码扫描**断言两者表集一致，防漂移。
 */

const SYNC_SERVICE_SOURCES = import.meta.glob('../sync-service.ts', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>

/** 从 `sync-service.ts` 源码提取 `SYNC_TABLES` 的表名集（只读扫描，不引入该模块） */
const syncTableNames = (): string[] => {
    const source = Object.values(SYNC_SERVICE_SOURCES)[0] ?? ''
    const start = source.indexOf('const SYNC_TABLES')
    const end = source.indexOf('\n]', start)
    const block = start < 0 || end < 0 ? '' : source.slice(start, end)
    return [...block.matchAll(/table:\s*'([^']+)'/g)].map((match) => match[1]!)
}

describe('冲突实体注册表 - 单一事实源一致性（T165）', () => {
    it('注册表 key 集 ≡ sync-service SYNC_TABLES 表集', () => {
        const expected = syncTableNames()
        expect(expected.length).toBeGreaterThan(0)
        const actual = CONFLICT_ENTITY_TABLES.map((config) => config.table)
        expect([...actual].sort()).toEqual([...expected].sort())
    })
})