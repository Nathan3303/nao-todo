/**
 * 会话续期调度器（AC6 / AC8 / AC11 / T3 / R4）
 *
 * @description 纯调度 + 失败分流，**零框架、零 Electron 依赖**：时钟 / 定时器 / checkin / 空闲判定
 *              全部注入 ⇒ 单测用假时钟即可确定性断言。口径（`docs/reports/T543-arch-review.md` §五 5.3）：
 *              ① 周期 **12h ±10% 抖动**（避免固定周期）；
 *              ② 触发补集 = 启动 / 定时到期 / 唤醒（`resume`）/ 联网（`online`）；
 *              ③ 任意两次尝试去抖 **≥5min**（成功后的重复触发不再请求；**失败后**交由退避控制，
 *                 `online` 表示网络已恢复 ⇒ 立即补续）；
 *              ④ 失败退避 **1m → 2m → 5m → 15m → 30m**（封顶），成功重置；
 *              ⑤ **网络失败不清凭证**（不登出、继续跑）；**凭证失败停续期 + 可见提示一次**。
 *              ⑥ 启动 60s 内的 checkin **合计恰好 1 次**（Q2 裁定）：应用层记录最近一次 checkin
 *                 **发起**时刻（`recordCheckInAttempt`），调度器据此复用页面冷启动那次结果。
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（AC6 / AC8 / AC11）
 * @see docs/reports/T543-arch-review.md（§三 T3 / §五 5.3）
 * @see docs/qa/2026-10-25-t544-baseline.md（§八 PM 裁定 Q1 / Q2）
 */

/** 续期周期（12h） */
export const RENEWAL_PERIOD_MS = 12 * 60 * 60 * 1000

/** 两次尝试的最小间隔（去抖，5min） */
export const RENEWAL_MIN_GAP_MS = 5 * 60 * 1000

/** 失败退避阶梯（1/2/5/15/30 分钟，封顶 30min） */
export const RENEWAL_BACKOFF_MS: readonly number[] = [1, 2, 5, 15, 30].map(
    (minutes) => minutes * 60 * 1000
)

/** 启动续期窗口：应用层在此窗口内已发起过 checkin ⇒ 调度器复用，不再重复请求（Q2） */
export const RENEWAL_START_WINDOW_MS = 60 * 1000

/** 抖动上下限（±10%） */
const JITTER_RATIO = 0.1

/** checkin 结果分流（由装配层把错误映射为这三态） */
export type RenewalCheckInResult = 'success' | 'network-error' | 'credential-error'

/** 触发原因（`launch` 由 `start()` 使用） */
export type RenewalTriggerReason = 'launch' | 'resume' | 'online'

export interface RenewalSchedulerDeps {
    /** 执行一次 checkin（内部复用 `AuthUseCase.checkIn`，含网络/凭证分流） */
    checkIn(): Promise<RenewalCheckInResult>
    now(): number
    /** 应用层记录的最近一次 checkin **发起**时刻（含页面冷启动那次）；无记录 ⇒ null */
    lastCheckInAt(): number | null
    timers: {
        set(callback: () => void, delayMs: number): unknown
        clear(handle: unknown): void
    }
    /** 用户/同步空闲（在途写入时不续期，避免旧 token 竞态） */
    isIdle(): boolean
    /** 凭证失效（停续期后**只提示一次**；隐藏态走系统通知） */
    onCredentialExpired(reason: 'credential-error'): void
    /** 抖动随机源（0..1；缺省 `Math.random`） */
    random?(): number
}

export interface RenewalScheduler {
    start(): Promise<void>
    stop(): void
    trigger(reason: RenewalTriggerReason): Promise<void>
    lastSuccessAt(): number | null
    nextAttemptAt(): number | null
    isRunning(): boolean
}

/** 最近一次 checkin **发起**时刻（模块级：页面冷启动与调度器共享同一记录） */
let lastCheckInAttemptAt: number | null = null

/**
 * 记录一次 checkin 发起（应用层在调用 `checkIn` 前记录）
 * @param at 发起时刻（缺省当前时间；单测可注入）
 */
export const recordCheckInAttempt = (at: number = Date.now()): void => {
    lastCheckInAttemptAt = at
}

/** 读取最近一次 checkin 发起时刻（调度器 `lastCheckInAt` 端口的默认实现） */
export const getLastCheckInAttemptAt = (): number | null => lastCheckInAttemptAt

/**
 * 创建续期调度器
 * @param deps 注入依赖（checkin / 时钟 / 定时器 / 空闲 / 凭证失效回调）
 */
export const createRenewalScheduler = (deps: RenewalSchedulerDeps): RenewalScheduler => {
    let active = false
    /** 凭证失效后彻底停摆（不再空转请求服务端） */
    let exhausted = false
    let timer: unknown = null
    let nextAt: number | null = null
    let successAt: number | null = null
    /** 最近一次尝试是否失败（失败后允许 `online` 立即补续，不受去抖限制） */
    let lastAttemptFailed = false
    let backoffIndex = 0
    let inFlight = false

    const random = (): number => (deps.random ? deps.random() : Math.random())

    /** 下一次周期 = 12h × (0.9 ~ 1.1) */
    const periodDelay = (): number =>
        Math.round(RENEWAL_PERIOD_MS * (1 - JITTER_RATIO + 2 * JITTER_RATIO * random()))

    const clearTimer = (): void => {
        if (timer !== null) {
            deps.timers.clear(timer)
            timer = null
        }
    }

    /** 排下一次尝试（幂等：先清旧定时器） */
    const schedule = (delayMs: number): void => {
        clearTimer()
        nextAt = deps.now() + delayMs
        timer = deps.timers.set(() => {
            timer = null
            nextAt = null
            void attempt()
        }, delayMs)
    }

    /** 执行一次续期尝试（非空闲 ⇒ 5min 后再试；凭证失败 ⇒ 停摆） */
    const attempt = async (): Promise<void> => {
        if (!active || exhausted || inFlight) return
        if (!deps.isIdle()) {
            schedule(RENEWAL_MIN_GAP_MS)
            return
        }
        inFlight = true
        try {
            const result = await deps.checkIn()
            if (!active) return
            if (result === 'credential-error') {
                exhausted = true
                clearTimer()
                nextAt = null
                deps.onCredentialExpired('credential-error')
                return
            }
            if (result === 'success') {
                successAt = deps.now()
                lastAttemptFailed = false
                backoffIndex = 0
                schedule(periodDelay())
                return
            }
            // 网络类失败：**不清凭证**，按阶梯退避重试
            lastAttemptFailed = true
            const delay = RENEWAL_BACKOFF_MS[Math.min(backoffIndex, RENEWAL_BACKOFF_MS.length - 1)]!
            backoffIndex += 1
            schedule(delay)
        } finally {
            inFlight = false
        }
    }

    return {
        start: async () => {
            if (active) return
            active = true
            exhausted = false
            const lastCheckInAt = deps.lastCheckInAt()
            if (lastCheckInAt !== null && deps.now() - lastCheckInAt < RENEWAL_START_WINDOW_MS) {
                // Q2：页面冷启动已发起过 ⇒ 复用之（合计恰好 1 次），但仍照常排下一次
                successAt = lastCheckInAt
                lastAttemptFailed = false
                schedule(periodDelay())
                return
            }
            await attempt()
        },

        stop: () => {
            active = false
            clearTimer()
            nextAt = null
        },

        trigger: async () => {
            if (!active || exhausted) return
            // 去抖：刚成功过 ⇒ 不再重复请求；最近一次失败则由退避接管，`online` 可立即补续
            if (
                !lastAttemptFailed &&
                successAt !== null &&
                deps.now() - successAt < RENEWAL_MIN_GAP_MS
            )
                return
            await attempt()
        },

        lastSuccessAt: () => successAt,
        nextAttemptAt: () => nextAt,
        isRunning: () => active && !exhausted
    }
}