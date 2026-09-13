/**
 * 推送重试分类与退避（SHELL-06 T1 / C-38 / C-39）
 * @description 纯函数层：失败三分类（网络/业务/凭证）、指数退避（5s→120s 封顶）、
 *              队列项到期判定（旧记录无 `nextAttemptAt` 视为可立即推送，C-44 兼容）。
 */

/** 失败分类（网络=暂停不计数；业务=退避计数；凭证=会话失效） */
export type SyncErrorClass = 'network' | 'business' | 'credential'

/** 业务类退避间隔（毫秒，指数封顶） */
export const PUSH_BACKOFF_INTERVALS_MS = [5_000, 10_000, 30_000, 60_000, 120_000] as const

/** 退避上限（毫秒） */
export const PUSH_BACKOFF_MAX_MS = PUSH_BACKOFF_INTERVALS_MS[PUSH_BACKOFF_INTERVALS_MS.length - 1]!

/** 第 `attempts` 次业务失败后的退避时长（attempts≤1 → 5s；超界封顶 120s） */
export const backoffDelayMs = (attempts: number): number => {
    const index = Math.min(Math.max(attempts, 1) - 1, PUSH_BACKOFF_INTERVALS_MS.length - 1)
    return PUSH_BACKOFF_INTERVALS_MS[index]!
}

/** 队列项最小形状（到期判定所需字段） */
export type RetryScheduleRecord = {
    attempts?: number
    retryCount?: number
    nextAttemptAt?: string | null
    lastErrorClass?: SyncErrorClass
}

/**
 * 队列项当前是否可推送（C-39）
 * @description `nextAttemptAt` 缺失/不可解析 ⇒ 视为可推（旧记录兼容，C-44）
 */
export const isRetryDue = (record: RetryScheduleRecord, nowMs: number): boolean => {
    if (!record.nextAttemptAt) return true
    const next = Date.parse(record.nextAttemptAt)
    if (!Number.isFinite(next)) return true
    return next <= nowMs
}

/** 条件退避定时基础间隔（毫秒，5s 起） */
export const BACKFILL_TICK_MS = 5000

/** 退避定时到期计算输入 */
export type BackfillDelayInput = {
    nowMs: number
    /** 服务级暂停截止（ms epoch；非暂停传 ≤ now） */
    pausedUntilMs: number
    /** 当前到期（可推）项数 */
    dueCount: number
    /** 队列中最早的 nextAttemptAt（ms epoch；无则 null） */
    earliestNextAttemptAtMs: number | null
    /** 当前退避层级（普通到期路径的指数因子） */
    level: number
}

/**
 * 计算下一次回传定时到期延时（SHELL-06-DEF-01 / C-40）
 * @description 暂停期也必须安排 tick（到期自动重试），不得 return 导致不自愈；
 *              返回 null 表示无需定时器（无待推送/暂停项）。
 *              上限 120s（PUSH_BACKOFF_MAX_MS）。
 */
export const computeBackfillDelayMs = (input: BackfillDelayInput): number | null => {
    const { nowMs, pausedUntilMs, dueCount, earliestNextAttemptAtMs, level } = input
    const clamp = (delay: number): number => Math.max(0, Math.min(delay, PUSH_BACKOFF_MAX_MS))
    if (pausedUntilMs > nowMs) return clamp(pausedUntilMs - nowMs)
    if (dueCount > 0) return clamp(BACKFILL_TICK_MS * 2 ** level)
    if (earliestNextAttemptAtMs !== null) return clamp(earliestNextAttemptAtMs - nowMs)
    return null
}

/** 队列上限判定（SHELL-06 C-41）：单表 ≥ perTable 或总量 ≥ total 即超限（仅提示不阻断） */
export const isQueueOverLimit = (
    counts: Iterable<number>,
    perTable = 1000,
    total = 2000
): boolean => {
    let sum = 0
    for (const count of counts) {
        sum += count
        if (count >= perTable) return true
    }
    return sum >= total
}

/** 推送失败分类输入 */
export type PushFailureInput = {
    /** HTTP 状态码（thrown 响应） */
    httpStatus?: number
    /** 归一化响应 code（字符串，如 ERR_NETWORK/超时） */
    normalizedCode?: unknown
    /** 业务码 10041 会话失效 */
    sessionExpired?: boolean
}

/**
 * 推送失败三分类（C-38）
 * @description 凭证（401/403/10041）> 网络（归一化 code / 5xx / 无状态码的传输异常）> 业务。
 *              **不得**使用 `navigator.onLine` 作为分类依据（C-43）。
 */
export const classifyPushFailure = (input: PushFailureInput): SyncErrorClass => {
    if (input.sessionExpired === true) return 'credential'
    if (input.httpStatus === 401 || input.httpStatus === 403) return 'credential'
    if (typeof input.normalizedCode === 'string') return 'network'
    if (typeof input.httpStatus === 'number' && input.httpStatus >= 500) return 'network'
    if (typeof input.httpStatus !== 'number') return 'network'
    return 'business'
}