import { describe, expect, it } from 'vite-plus/test'
import {
    backoffDelayMs,
    classifyPushFailure,
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