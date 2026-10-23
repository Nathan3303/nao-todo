import { describe, expect, it } from 'vite-plus/test'
import { createClaimLedger } from '@nao-todo/shared/reminder'
import { FakeStorage } from './reminder-harness'

/**
 * T525 · 去重账本 `createClaimLedger`（AC3 / AC4 / AC6）
 *
 * @see ../__tests__/reminder-harness.ts（契约总表：同步、幂等、原子；storage 不可用 ⇒ 内存降级）
 */

const KEY = 't1@2026-10-23T10:00:00.000Z'

describe('createClaimLedger · 唯一性（AC3）', () => {
    it('首次 claim ⇒ true；同实例再 claim ⇒ false；has ⇒ true', () => {
        const ledger = createClaimLedger({ storage: new FakeStorage() })

        expect(ledger.has(KEY)).toBe(false)
        expect(ledger.claim(KEY)).toBe(true)
        expect(ledger.claim(KEY)).toBe(false)
        expect(ledger.has(KEY)).toBe(true)
    })

    it('不同键互不影响', () => {
        const ledger = createClaimLedger({ storage: new FakeStorage() })

        expect(ledger.claim('a@1')).toBe(true)
        expect(ledger.claim('b@1')).toBe(true)
        expect(ledger.claim('a@1')).toBe(false)
        expect(ledger.claim('b@1')).toBe(false)
    })
})

describe('createClaimLedger · 持久化（AC3：刷新 / 重开 / 另一标签）', () => {
    it('同一 storage 上的新实例「记得」已落账 ⇒ claim false', () => {
        const storage = new FakeStorage()
        const first = createClaimLedger({ storage })

        expect(first.claim(KEY)).toBe(true)
        expect(storage.size).toBeGreaterThan(0)

        const second = createClaimLedger({ storage }) // 模拟刷新 / 重开 / 另一标签

        expect(second.has(KEY)).toBe(true)
        expect(second.claim(KEY)).toBe(false)
    })
})

describe('createClaimLedger · 存储不可用降级（AC6 / §六可用性）', () => {
    it('storage 全抛（隐私模式）⇒ 不抛错，退化为内存账本（同标签内仍唯一）', () => {
        const storage = new FakeStorage()
        storage.failAll = true
        const ledger = createClaimLedger({ storage })

        expect(() => ledger.claim(KEY)).not.toThrow()
        expect(ledger.claim(KEY)).toBe(true)
        expect(ledger.claim(KEY)).toBe(false)
        expect(ledger.has(KEY)).toBe(true)
    })

    it('storage 写抛（配额不足）⇒ 不抛错，仍能落账（内存降级）', () => {
        const storage = new FakeStorage()
        storage.failOnSet = true
        const ledger = createClaimLedger({ storage })

        expect(() => ledger.claim(KEY)).not.toThrow()
        expect(ledger.claim(KEY)).toBe(true)
        expect(ledger.claim(KEY)).toBe(false)
    })

    it('未提供 storage（无 localStorage 环境）⇒ 内存账本可用、不抛错', () => {
        const ledger = createClaimLedger({})

        expect(ledger.claim(KEY)).toBe(true)
        expect(ledger.claim(KEY)).toBe(false)
    })
})