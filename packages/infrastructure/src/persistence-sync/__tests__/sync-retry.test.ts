import { describe, expect, it } from 'vite-plus/test'
import {
    backoffDelayMs,
    classifyPushFailure,
    computeBackfillDelayMs,
    isQueueOverLimit,
    isRetryDue,
    PUSH_BACKOFF_MAX_MS
} from '../sync-retry'

/**
 * SHELL-06 T1/T2 纯层：失败三分类（C-38）、指数退避（C-39）、到期判定（C-44）、上限（C-41）
 */

describe('classifyPushFailure - 失败三分类（C-38）', () => {
    it('凭证类：401/403/10041', () => {
        expect(classifyPushFailure({ httpStatus: 401 })).toBe('credential')
        expect(classifyPushFailure({ httpStatus: 403 })).toBe('credential')
        expect(classifyPushFailure({ sessionExpired: true })).toBe('credential')
    })

    it('网络类：归一化 code / 5xx / 无状态码', () => {
        expect(classifyPushFailure({ normalizedCode: 'ERR_NETWORK' })).toBe('network')
        expect(classifyPushFailure({ httpStatus: 500 })).toBe('network')
        expect(classifyPushFailure({ httpStatus: 503 })).toBe('network')
        expect(classifyPushFailure({})).toBe('network')
    })

    it('业务类：非鉴权 4xx', () => {
        expect(classifyPushFailure({ httpStatus: 400 })).toBe('business')
        expect(classifyPushFailure({ httpStatus: 422 })).toBe('business')
    })
})

describe('backoffDelayMs - 指数退避封顶 120s（C-39）', () => {
    it('序列 5s→10s→30s→60s→120s，超界封顶', () => {
        expect([1, 2, 3, 4, 5].map(backoffDelayMs)).toEqual([5000, 10000, 30000, 60000, 120000])
        expect(backoffDelayMs(6)).toBe(120000)
        expect(backoffDelayMs(0)).toBe(5000)
        expect(PUSH_BACKOFF_MAX_MS).toBe(120000)
    })
})

describe('isRetryDue - 到期判定（C-39/C-44）', () => {
    const now = Date.parse('2026-09-13T00:00:00.000Z')

    it('缺失/空/不可解析 ⇒ 可立即推送（旧记录兼容）', () => {
        expect(isRetryDue({}, now)).toBe(true)
        expect(isRetryDue({ nextAttemptAt: null }, now)).toBe(true)
        expect(isRetryDue({ nextAttemptAt: 'not-a-date' }, now)).toBe(true)
    })

    it('未到期 ⇒ 不可推；已到期 ⇒ 可推', () => {
        expect(isRetryDue({ nextAttemptAt: new Date(now + 1000).toISOString() }, now)).toBe(false)
        expect(isRetryDue({ nextAttemptAt: new Date(now - 1000).toISOString() }, now)).toBe(true)
    })
})

describe('computeBackfillDelayMs - 暂停到期安排 tick（SHELL-06-DEF-01）', () => {
    const base = {
        nowMs: 1000,
        pausedUntilMs: 0,
        dueCount: 0,
        earliestNextAttemptAtMs: null as number | null,
        level: 0
    }

    it('暂停中：按 pausedUntil 到期安排（不得返回 null 导致不自愈）', () => {
        expect(computeBackfillDelayMs({ ...base, pausedUntilMs: 6000 })).toBe(5000)
        expect(computeBackfillDelayMs({ ...base, pausedUntilMs: 1000 + 200000 })).toBe(120000)
    })

    it('有到期项：指数间隔（5s 起步、120s 封顶）', () => {
        expect(computeBackfillDelayMs({ ...base, dueCount: 2, level: 0 })).toBe(5000)
        expect(computeBackfillDelayMs({ ...base, dueCount: 2, level: 2 })).toBe(20000)
        expect(computeBackfillDelayMs({ ...base, dueCount: 2, level: 9 })).toBe(120000)
    })

    it('业务退避未到期：按最早 nextAttemptAt 唤醒（可为 0）', () => {
        expect(computeBackfillDelayMs({ ...base, earliestNextAttemptAtMs: 7000 })).toBe(6000)
        expect(computeBackfillDelayMs({ ...base, earliestNextAttemptAtMs: 500 })).toBe(0)
    })

    it('拉取未取尽（DEF-6）：无脏队列/无暂停也安排补拉 tick（复用同一指数退避）', () => {
        expect(computeBackfillDelayMs({ ...base, pullPending: true })).toBe(5000)
        expect(computeBackfillDelayMs({ ...base, pullPending: true, level: 2 })).toBe(20000)
        expect(computeBackfillDelayMs({ ...base, pullPending: true, level: 9 })).toBe(120000)
        // 未标记 pullPending 时仍为 null（不创建定时器）
        expect(computeBackfillDelayMs({ ...base, pullPending: false })).toBeNull()
    })

    it('无待推送/暂停项 ⇒ null（不创建定时器）', () => {
        expect(computeBackfillDelayMs(base)).toBeNull()
    })
})

describe('isQueueOverLimit - 队列上限（C-41）', () => {
    it('单表 1000 / 总量 2000 阈值', () => {
        expect(isQueueOverLimit([1000])).toBe(true)
        expect(isQueueOverLimit([2000])).toBe(true)
        expect(isQueueOverLimit([999, 1000])).toBe(true)
        expect(isQueueOverLimit([999, 999])).toBe(false)
        expect(isQueueOverLimit([1, 2, 3])).toBe(false)
        expect(isQueueOverLimit([])).toBe(false)
    })
})