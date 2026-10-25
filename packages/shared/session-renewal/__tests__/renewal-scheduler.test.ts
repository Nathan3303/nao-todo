import { describe, expect, it, vi } from 'vite-plus/test'

/**
 * T544 · 会话续期调度器（AC6 / AC11 / AC8 / T3 / R4）
 *
 * @description 纯调度 + 失败分流，全部靠**注入时钟/定时器/checkIn** 驱动（无真实等待、无框架依赖）：
 *              ① 周期 12h ±10% 抖动；② 触发补集 = 启动 / 唤醒 / `online` / 距上次成功 ≥12h；
 *              ③ 任意两次尝试去抖 ≥5min；④ 失败退避 1m→2m→5m→15m→30m 封顶、成功重置；
 *              ⑤ **网络失败不清凭证**（不登出，恢复后补续）；**凭证失败停续期 + 可见提示**。
 *
 * 期望实现落点：`packages/shared/session-renewal/index.ts`（纯调度器，无 Electron/框架依赖）
 * 契约：`createRenewalScheduler({ checkIn, now, timers, isIdle, onCredentialExpired, random })`
 *       → `{ start(), stop(), trigger(reason), lastSuccessAt(), nextAttemptAt(), isRunning() }`
 *       常量：`RENEWAL_PERIOD_MS` / `RENEWAL_MIN_GAP_MS` / `RENEWAL_BACKOFF_MS`
 *
 * 口径提示（本文件按 T3 字面实现，见回执「PRD 歧义」）：`resume` / `online` 属**补集触发**
 * ——距上次成功不足 12h 也会续期，只受 ≥5min 去抖约束。
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（AC6 / AC8 / AC11）
 * @see docs/reports/T543-arch-review.md（§三 T3 / §五 5.3 续期时序与失败分流）
 */

type CheckInResult = 'success' | 'network-error' | 'credential-error'

interface RenewalSchedulerDeps {
    checkIn(): Promise<CheckInResult>
    now(): number
    timers: {
        set(callback: () => void, delayMs: number): unknown
        clear(handle: unknown): void
    }
    isIdle(): boolean
    onCredentialExpired(reason: 'credential-error'): void
    random?(): number
}

interface RenewalScheduler {
    start(): Promise<void> | void
    stop(): void
    trigger(reason: 'launch' | 'resume' | 'online'): Promise<void> | void
    lastSuccessAt(): number | null
    nextAttemptAt(): number | null
    isRunning(): boolean
}

interface RenewalModule {
    createRenewalScheduler(deps: RenewalSchedulerDeps): RenewalScheduler
    RENEWAL_PERIOD_MS: number
    RENEWAL_MIN_GAP_MS: number
    RENEWAL_BACKOFF_MS: readonly number[]
}

const MODULE = 'packages/shared/session-renewal/index.ts'
const SPECIFIER = '../index'
const HOUR = 3_600_000
const MINUTE = 60_000

/** 缺实现装载器（同 `apps/desktop` 口径：变量说明符 ⇒ 逐条用例给出「缺实现」原因） */
const load = async (ac: string): Promise<RenewalModule> => {
    let mod: Record<string, unknown>
    try {
        // 说明符必须是变量：字面量会被 Vite 静态解析 ⇒ 模块缺失变成整文件收集期失败
        mod = (await import(/* @vite-ignore */ SPECIFIER)) as Record<string, unknown>
    } catch (error) {
        throw new Error(`[缺实现] 期望模块 ${MODULE}（${ac}）；当前：${(error as Error).message}`)
    }
    const missing = [
        'createRenewalScheduler',
        'RENEWAL_PERIOD_MS',
        'RENEWAL_MIN_GAP_MS',
        'RENEWAL_BACKOFF_MS'
    ].filter((name) => typeof mod[name] === 'undefined')
    if (missing.length > 0) {
        throw new Error(`[缺实现] ${MODULE} 缺少导出：${missing.join('、')}（${ac}）`)
    }
    return mod as unknown as RenewalModule
}

const flush = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 0))
}

const createEnv = async (options: {
    ac: string
    results?: CheckInResult[]
    idle?: boolean
    random?: () => number
}) => {
    const mod = await load(options.ac)
    const BASE = new Date('2026-10-25T00:00:00.000Z').getTime()
    const results = [...(options.results ?? [])]
    let now = BASE
    let seq = 0
    let idle = options.idle ?? true
    const delays: number[] = []
    const timers = new Map<number, { at: number; callback: () => void }>()
    const checkIn = vi.fn(async (): Promise<CheckInResult> => results.shift() ?? 'success')
    const onCredentialExpired = vi.fn()

    const deps: RenewalSchedulerDeps = {
        checkIn,
        now: () => now,
        timers: {
            set: (callback, delayMs) => {
                delays.push(delayMs)
                const id = ++seq
                timers.set(id, { at: now + delayMs, callback })
                return id
            },
            clear: (handle) => {
                timers.delete(handle as number)
            }
        },
        isIdle: () => idle,
        onCredentialExpired,
        ...(options.random ? { random: options.random } : {})
    }

    const scheduler = mod.createRenewalScheduler(deps)

    /** 推进时间并**触发**到期的定时器（按到期顺序） */
    const advance = async (ms: number): Promise<void> => {
        const target = now + ms
        for (;;) {
            const due = [...timers.entries()]
                .filter(([, timer]) => timer.at <= target)
                .sort((a, b) => a[1].at - b[1].at)[0]
            if (!due) break
            const [id, timer] = due
            timers.delete(id)
            if (timer.at > now) now = timer.at
            timer.callback()
            await flush()
        }
        if (target > now) now = target
    }

    /** 只跳时钟、**不**触发定时器（模拟系统休眠 / 定时器漂移） */
    const jump = (ms: number): void => {
        now += ms
    }

    return {
        mod,
        scheduler,
        checkIn,
        onCredentialExpired,
        delays,
        timers,
        now: () => now,
        advance,
        jump,
        setIdle: (next: boolean) => {
            idle = next
        }
    }
}

describe('续期常量与周期（T3）', () => {
    it('周期 = 12h、去抖 ≥5min、退避 = 1/2/5/15/30min（T3 硬指标）', async () => {
        const { mod } = await createEnv({ ac: 'T3' })

        expect(mod.RENEWAL_PERIOD_MS).toBe(12 * HOUR)
        expect(mod.RENEWAL_MIN_GAP_MS).toBeGreaterThanOrEqual(5 * MINUTE)
        expect(mod.RENEWAL_BACKOFF_MS).toEqual([1, 2, 5, 15, 30].map((m) => m * MINUTE))
    })

    it('续期成功后下一次到期落在 12h ±10%（抖动不越界）（T3）', async () => {
        for (const [seed, expected] of [
            [0, 10.8 * HOUR],
            [0.5, 12 * HOUR],
            [1, 13.2 * HOUR]
        ] as const) {
            const env = await createEnv({ ac: 'T3', random: () => seed })
            await env.scheduler.start()

            expect(env.scheduler.lastSuccessAt()).toBe(env.now())
            expect(env.scheduler.nextAttemptAt()).toBe(env.now() + expected)
        }
    })

    it('多次续期的抖动不固定在 12h（避免固定周期被服务端识别）', async () => {
        const env = await createEnv({ ac: 'T3', random: () => Math.random() })
        await env.scheduler.start()
        const first = env.delays.at(-1) ?? 0
        await env.advance(first)
        const second = env.delays.at(-1) ?? 0

        expect(first).toBeGreaterThanOrEqual(10.8 * HOUR)
        expect(first).toBeLessThanOrEqual(13.2 * HOUR)
        expect(second).toBeGreaterThanOrEqual(10.8 * HOUR)
        expect(second).toBeLessThanOrEqual(13.2 * HOUR)
        expect(first).not.toBe(second)
    })
})

describe('触发补集（T3 / AC6）', () => {
    it('启动即续期一次（启动触发）', async () => {
        const env = await createEnv({ ac: 'AC6' })

        await env.scheduler.start()

        expect(env.checkIn).toHaveBeenCalledTimes(1)
    })

    it('定时到期 ⇒ 12h 后自动续期（距上次成功 ≥12h）', async () => {
        const env = await createEnv({ ac: 'AC6', random: () => 0.5 })
        await env.scheduler.start()

        await env.advance(12 * HOUR)

        expect(env.checkIn).toHaveBeenCalledTimes(2)
    })

    it.each(['resume', 'online'] as const)(
        '%s 触发 ⇒ 立即补续（休眠唤醒 / 网络恢复）',
        async (reason) => {
            const env = await createEnv({ ac: 'AC11' })
            await env.scheduler.start()
            env.jump(3 * HOUR)

            await env.scheduler.trigger(reason)

            expect(env.checkIn).toHaveBeenCalledTimes(2)
            expect(env.scheduler.lastSuccessAt()).toBe(env.now())
        }
    )

    it('去抖 ≥5min：1 分钟内的重复触发不再请求（防网络抖动风暴）', async () => {
        const env = await createEnv({ ac: 'AC11' })
        await env.scheduler.start()

        env.jump(1 * MINUTE)
        await env.scheduler.trigger('online')
        await env.scheduler.trigger('resume')

        expect(env.checkIn).toHaveBeenCalledTimes(1)
    })

    it('去抖窗口过后（≥5min）的触发正常补续', async () => {
        const env = await createEnv({ ac: 'AC11' })
        await env.scheduler.start()

        env.jump(5 * MINUTE)
        await env.scheduler.trigger('online')

        expect(env.checkIn).toHaveBeenCalledTimes(2)
    })
})

describe('失败退避（T3 / AC11 / R4）', () => {
    it('网络失败 ⇒ 退避 1m→2m→5m→15m→30m 封顶（成功前不超 30min）', async () => {
        const env = await createEnv({
            ac: 'AC11',
            results: Array.from({ length: 6 }, () => 'network-error' as const)
        })

        await env.scheduler.start()
        const observed: number[] = [env.delays.at(-1) ?? 0]
        for (let i = 0; i < 5; i += 1) {
            await env.advance(observed.at(-1) ?? 0)
            observed.push(env.delays.at(-1) ?? 0)
        }

        expect(observed).toEqual([
            1 * MINUTE,
            2 * MINUTE,
            5 * MINUTE,
            15 * MINUTE,
            30 * MINUTE,
            30 * MINUTE
        ])
        expect(env.checkIn).toHaveBeenCalledTimes(6)
    })

    it('网络失败不清凭证、不登出（凭证仍在，续期继续跑）（R4 / AC11）', async () => {
        const env = await createEnv({ ac: 'AC11', results: ['network-error'] })

        await env.scheduler.start()

        expect(env.onCredentialExpired).not.toHaveBeenCalled()
        expect(env.scheduler.isRunning()).toBe(true)
        expect(env.scheduler.nextAttemptAt()).toBe(env.now() + 1 * MINUTE)
    })

    it('网络恢复 ⇒ 立即补续，成功后回到 12h 周期并重置退避（AC11）', async () => {
        const env = await createEnv({ ac: 'AC11', results: ['network-error', 'network-error'] })
        await env.scheduler.start()
        await env.advance(1 * MINUTE)
        expect(env.delays.at(-1)).toBe(2 * MINUTE)

        await env.scheduler.trigger('online')

        expect(env.checkIn).toHaveBeenCalledTimes(3)
        expect(env.delays.at(-1)).toBeGreaterThanOrEqual(10.8 * HOUR)
        expect(env.delays.at(-1)).toBeLessThanOrEqual(13.2 * HOUR)
    })

    it('凭证失败 ⇒ 停续期 + 可见提示（只提示一次，不再空转请求）（AC8 / R4）', async () => {
        const env = await createEnv({ ac: 'AC8', results: ['credential-error'] })

        await env.scheduler.start()

        expect(env.onCredentialExpired).toHaveBeenCalledTimes(1)
        expect(env.scheduler.isRunning()).toBe(false)
        expect(env.scheduler.nextAttemptAt()).toBeNull()
    })

    it('凭证失败后 online / resume 不再请求（避免反复打服务端）', async () => {
        const env = await createEnv({ ac: 'AC8', results: ['credential-error'] })
        await env.scheduler.start()

        env.jump(HOUR)
        await env.scheduler.trigger('online')
        await env.scheduler.trigger('resume')

        expect(env.checkIn).toHaveBeenCalledTimes(1)
        expect(env.onCredentialExpired).toHaveBeenCalledTimes(1)
    })
})

describe('空闲门与停止（T3 / AC12）', () => {
    it('非空闲 ⇒ 本次不续期，5min 后重试（不打断同步在途写入）', async () => {
        const env = await createEnv({ ac: 'AC12', idle: false })

        await env.scheduler.start()

        expect(env.checkIn).not.toHaveBeenCalled()
        expect(env.delays.at(-1)).toBeGreaterThanOrEqual(5 * MINUTE)

        env.setIdle(true)
        await env.advance(5 * MINUTE)

        expect(env.checkIn).toHaveBeenCalledTimes(1)
    })

    it('stop() ⇒ 清定时器，不再续期（退出应用后不留定时器）', async () => {
        const env = await createEnv({ ac: 'AC2' })
        await env.scheduler.start()

        env.scheduler.stop()
        await env.advance(24 * HOUR)

        expect(env.checkIn).toHaveBeenCalledTimes(1)
        expect(env.timers.size).toBe(0)
    })
})