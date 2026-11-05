/**
 * 可见窗口自动刷新（同步感知 A′ / T654）
 *
 * @description 「窗口停在列表上不动时，他端改动 ≤30s 自己出现」的**门控层**：
 *              只决定「**何时**调一次既有拉取入口」，不参与任何数据裁决
 *              （OCC / `baseUpdatedAt` / 冲突落账 / `pull-local-wins` 零改动，AC8）。
 *
 *              门控优先级（PRD R-4）：`隐藏 > 离线 > 脏队列 > 周期`
 *              - 隐藏：清定时器 ⇒ **零请求、零空转**（AC5）；
 *              - 离线：清定时器、不建新定时器（AC4）；
 *              - 脏队列：**仅周期拉取**跳过（避免 `remote-wins` 抢走正在输入的内容，AC6）；
 *                `visible` / `online` / 手动 属用户可感知动作，**不受此门限制**（不得饿死）。
 *
 *              退避（R-5 / AC3）：复用既有退避实现 `backoffDelayMs`
 *              （`sync-retry.ts` 的 `PUSH_BACKOFF_INTERVALS_MS`：5s→10s→30s→60s→120s 封顶），
 *              **不新建第二套间隔表**；成功即清零并回到 30s 周期。
 *
 *              合并门（R-9 / AC5b）不在本层：它由 `SyncService.resumeBackfill()` 统一实现
 *              （事件触发距上次**成功**拉取 <10s ⇒ 只推不拉），本层只是「事件 → 调入口」。
 *
 *              单主 + 广播（R-6 / AC7）同样不在本层：锁在 `SyncService`（`navigator.locks`），
 *              广播在 `pull-broadcast.ts`；本层不做第二套选主。
 *
 *              纯逻辑（时间/拉取/脏队列判定全部注入）⇒ 可用假定时器单测 AC1/AC3/AC5/AC6/AC10。
 */

import { backoffDelayMs } from './sync-retry'

/** 可见空闲态周期（PRD 指标 2：≤2 次/分） */
export const AUTO_REFRESH_INTERVAL_MS = 30_000

/** 触发来源（周期 / 回到可见 / 恢复联网） */
export type AutoRefreshTrigger = 'periodic' | 'visible' | 'online'

/** 一次拉取的结果（`stop` = 凭证失效，停止周期重试，AC4） */
export interface AutoRefreshPullOutcome {
    /** 本次运行是否无错误（`SyncRunResult.ok`） */
    ok: boolean
    /** 凭证类失败 ⇒ 立即停用（既有鉴权过期路径接手清理与导航） */
    stop?: boolean
}

/** 定时器句柄（注入方可为任意实现；默认用运行时 `setTimeout` 返回值） */
export type AutoRefreshTimerHandle = ReturnType<typeof setTimeout>

export interface AutoRefreshDeps {
    /** 拉取入口（**必须**是既有串行入口：`syncService.pullAll` / `resumeBackfill`） */
    pull(trigger: AutoRefreshTrigger): Promise<AutoRefreshPullOutcome>
    /** 本地是否仍有未推送改动（脏队列门控；仅周期拉取使用） */
    hasPendingLocalWrites(): Promise<boolean>
    /** 当前是否可见（web = `document.visibilityState`；desktop = 主进程 IPC 信号） */
    isVisible(): boolean
    /** 当前是否离线（离线不建定时器，AC4） */
    isOffline(): boolean
    setTimeout(handler: () => void, delayMs: number): AutoRefreshTimerHandle
    clearTimeout(timer: AutoRefreshTimerHandle): void
    /** 连续失败回调（结构化日志用；不得抛错、不得改变门控） */
    onFailure?(info: { trigger: AutoRefreshTrigger; failures: number; delayMs: number }): void
    /** 意外异常（审计用；门控已按失败退避处理） */
    onError?(error: unknown): void
}

export interface AutoRefreshController {
    /** 启动周期（首次拉取由既有 `syncService.start()` 负责，避免重复） */
    start(): void
    /** 可见性信号（隐藏 ⇒ 清定时器；显示 ⇒ 立即触发一次） */
    setVisible(visible: boolean): void
    /** 离线信号（离线 ⇒ 清定时器；恢复 ⇒ 立即触发一次） */
    setOffline(offline: boolean): void
    /** 停止周期并释放定时器（卸载/登出） */
    dispose(): void
    /** 是否已停用（凭证失效或显式释放） */
    isDisposed(): boolean
    /** 连续失败次数（0 = 正常态；测试/诊断用） */
    getFailureCount(): number
}

/**
 * 创建自动刷新门控
 * @param deps 注入依赖（拉取入口 / 脏队列判定 / 可见性 / 离线判定 / 定时器）
 */
export const createAutoRefreshController = (deps: AutoRefreshDeps): AutoRefreshController => {
    let disposed = false
    let visible = deps.isVisible()
    let offline = deps.isOffline()
    let timer: AutoRefreshTimerHandle | null = null
    let failures = 0
    /** 拉取在途：事件触发只合并、不叠加（避免 alt-tab 抖动排队） */
    let inFlight = false

    const clearTimer = (): void => {
        if (timer === null) return
        deps.clearTimeout(timer)
        timer = null
    }

    /** 安排下一次周期（隐藏/离线/已停用 ⇒ 不建定时器） */
    const schedule = (delayMs: number): void => {
        clearTimer()
        if (disposed || !visible || offline) return
        timer = deps.setTimeout(() => {
            timer = null
            void tick()
        }, delayMs)
    }

    const onSuccess = (): void => {
        failures = 0
        schedule(AUTO_REFRESH_INTERVAL_MS)
    }

    const onFailure = (trigger: AutoRefreshTrigger): void => {
        failures += 1
        const delayMs = backoffDelayMs(failures)
        deps.onFailure?.({ trigger, failures, delayMs })
        schedule(delayMs)
    }

    /** 执行一次拉取并按结果安排下一步（成功 30s / 失败退避 / 凭证停用） */
    const runPull = async (trigger: AutoRefreshTrigger): Promise<void> => {
        if (disposed || inFlight) return
        // 门控优先级（R-4）：隐藏 / 离线均不得发请求（事件触发同样受前两项约束）
        if (!visible || offline) return
        inFlight = true
        try {
            const outcome = await deps.pull(trigger)
            if (disposed) return
            if (outcome.stop === true) {
                // AC4：凭证失效 ⇒ 不周期重试；清凭据/回登录页由既有鉴权过期路径负责
                clearTimer()
                disposed = true
                return
            }
            if (outcome.ok) onSuccess()
            else onFailure(trigger)
        } catch (error) {
            if (disposed) return
            deps.onError?.(error)
            onFailure(trigger)
        } finally {
            inFlight = false
        }
    }

    /** 周期检查：脏队列非空 ⇒ 本轮不拉，等下一周期（≤1 周期恢复，AC6） */
    const tick = async (): Promise<void> => {
        if (disposed || !visible || offline) return
        let pending = false
        try {
            pending = await deps.hasPendingLocalWrites()
        } catch (error) {
            // 读队列失败**不得**退化成「照拉」（可能抢走正在输入的内容）⇒ 记错并按失败退避
            deps.onError?.(error)
            onFailure('periodic')
            return
        }
        // 读队列期间状态可能变化（隐藏/离线/停用）⇒ 复查后再决定
        if (disposed || !visible || offline) return
        if (pending) {
            schedule(AUTO_REFRESH_INTERVAL_MS)
            return
        }
        await runPull('periodic')
    }

    return {
        start: () => {
            if (disposed) return
            schedule(AUTO_REFRESH_INTERVAL_MS)
        },

        setVisible: (next) => {
            if (disposed) return
            visible = next
            if (!next) {
                clearTimer()
                return
            }
            // 回到可见 ⇒ 立即拉一次（合并门在 SyncService 内，AC5b）
            void runPull('visible')
        },

        setOffline: (next) => {
            if (disposed) return
            offline = next
            if (next) {
                clearTimer()
                return
            }
            void runPull('online')
        },

        dispose: () => {
            disposed = true
            clearTimer()
        },

        isDisposed: () => disposed,

        getFailureCount: () => failures
    }
}