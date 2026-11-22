/**
 * 启动期接线（ADR「启动不阻断」）
 *
 * @description 三件事，且**每一件都不允许抛到外面**：
 *              ① 同步构造内核（零网络、零磁盘写）——构造异常由调用方（`main/index.ts`）兜住；
 *              ② `start()` 把**启动静默检查延后 ≥10s**（PRD §六 性能：不得阻塞首屏）；
 *              ③ 定时器 / 检查 / 回调全部 `try/catch`，任何异常只落状态与本地日志；
 *                 日志只收**脱敏摘要**（AC9b：不含本机路径 / 主机名 / 底层原文）。
 *              ④ `unsupported` 形态（未打包开发态 / deb / macOS）下的静默检查同样过内核
 *                 gate ⇒ **零请求**（AC4b，`checker` 调用数恒 0）。
 *              本文件零 `electron` 依赖（时钟与定时器注入），可用例直接断言「延后多少毫秒、异常不外抛」。
 * @see docs/prds/2026-11-20-desktop-self-update.md（§六 / AC1 / AC4b / AC8 / AC9b）
 * @see docs/adr/2026-11-20-desktop-self-update.md（启动不阻断）
 */
import {
    createUpdaterCore,
    describeFailureForLog,
    type CreateUpdaterCoreOptions,
    type UpdaterCore
} from './core'

/** 启动静默检查的最小延后（NFR：≥10s） */
export const UPDATE_STARTUP_CHECK_DELAY_MS = 10_000

/** 定时器最小面（注入以便用例捕获延后毫秒数） */
export interface UpdaterTimer {
    setTimeout(callback: () => void, delayMs: number): unknown
}

export interface CreateDesktopUpdaterOptions extends CreateUpdaterCoreOptions {
    /** 延后毫秒（缺省 10s；**小于 10s 会被抬到 10s**，NFR 不靠调用方自觉） */
    startupCheckDelayMs?: number
    timer?: UpdaterTimer
}

export interface DesktopUpdater {
    core: UpdaterCore
    /** 启动静默检查（幂等：重复调用只排一次） */
    start(): void
}

const defaultTimer: UpdaterTimer = {
    setTimeout: (callback, delayMs) => setTimeout(callback, delayMs)
}

/**
 * 创建桌面更新器（内核 + 启动静默检查）
 * @param options 五端口 / 缓存面 / 时钟 / 延后 / 定时器
 */
export const createDesktopUpdater = (options: CreateDesktopUpdaterOptions): DesktopUpdater => {
    const core = createUpdaterCore(options)
    const delayMs = Math.max(
        options.startupCheckDelayMs ?? UPDATE_STARTUP_CHECK_DELAY_MS,
        UPDATE_STARTUP_CHECK_DELAY_MS
    )
    const timer = options.timer ?? defaultTimer
    let started = false

    const runSilentCheck = (): void => {
        try {
            // `check` 自身不抛（内部已收敛为 failed 状态，unsupported 形态则直接 0 请求）
            void core
                .check({ manual: false })
                .catch((error: unknown) => options.onError?.(describeFailureForLog(error)))
        } catch (error) {
            options.onError?.(describeFailureForLog(error))
        }
    }

    return {
        core,
        start: () => {
            if (started) return
            started = true
            try {
                timer.setTimeout(runSilentCheck, delayMs)
            } catch (error) {
                // 定时器不可用（异常环境）⇒ 放弃本次静默检查，绝不阻断启动
                options.onError?.(describeFailureForLog(error))
            }
        }
    }
}