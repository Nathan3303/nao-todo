// @vitest-environment node
import { describe, expect, it } from 'vite-plus/test'
import { countAudit } from '../audit-log'

/**
 * `T707` · 修复项 1 的**永久守卫**：`countAudit` 在**无 IndexedDB** 环境下**不 reject**
 *
 * @description 背景（`T706` 独立复验发现）：`loadAudit` / `recordAudit` / `pruneAuditLog` 都已
 *              兜住「无库 / 库操作抛错」，只有 `countAudit` 没兜 ⇒ node 环境下抛 `MissingAPIError`。
 *              本文件**不加载** `fake-indexeddb`（node 环境本就没有 `indexedDB`），只断言行为
 *              （⛔ 不靠读代码推定）。
 * @see docs/reports/346-audit-log-red-baseline.md（`T706` 复核）
 */

describe('T707 / countAudit 无 IndexedDB 环境兜底', () => {
    it('无 IndexedDB ⇒ resolve 0（不 reject、不抛）', async () => {
        // 前置自检：本环境确实没有 IndexedDB（否则本用例无意义）
        expect((globalThis as { indexedDB?: unknown }).indexedDB).toBeUndefined()

        await expect(countAudit('t707-no-idb-user')).resolves.toBe(0)
        // 缺省用户同样按 0 处理（不因无会话/无库抛回调用方）
        await expect(countAudit()).resolves.toBe(0)
    })
})