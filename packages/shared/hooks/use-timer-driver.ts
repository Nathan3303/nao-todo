/**
 * UI 刷新间隔（毫秒）
 */
const TICK_INTERVAL_MS = 250

/**
 * 计时驱动 composable
 * @description 抽离番茄倒计时与正计时两个 store 共用的计时基础设施：
 *              - setInterval tick 引擎
 *              - visibilitychange 监听（页面切换回来后补一次 tick 修正显示）
 *              - destroy 清理
 *              独有的时间数学与控制逻辑仍由各 store 自行维护。
 * @param tick 每 250ms 执行的回调
 * @param isRunning 判定当前是否处于运行态（用于 visibility 补偿）
 */
export const useTimerDriver = (tick: () => void, isRunning: () => boolean) => {
    // ========================================================================
    // Internal Engine State（plain variables，非响应式）
    // ========================================================================
    let intervalId: ReturnType<typeof setInterval> | null = null
    let visibilityHandler: (() => void) | null = null

    // ========================================================================
    // Interval & Engine
    // ========================================================================

    const start = () => {
        stop()
        intervalId = setInterval(tick, TICK_INTERVAL_MS)
    }

    const stop = () => {
        if (intervalId !== null) {
            clearInterval(intervalId)
            intervalId = null
        }
    }

    // ========================================================================
    // Visibility Change（页面切换回来后修正时间显示）
    // ========================================================================

    const setupVisibilityListener = () => {
        if (visibilityHandler) return
        visibilityHandler = () => {
            if (document.hidden) return
            if (!isRunning()) return
            requestAnimationFrame(() => {
                if (isRunning()) tick()
            })
        }
        document.addEventListener('visibilitychange', visibilityHandler)
    }

    const teardownVisibilityListener = () => {
        if (visibilityHandler) {
            document.removeEventListener('visibilitychange', visibilityHandler)
            visibilityHandler = null
        }
    }

    /**
     * 销毁（清理 interval 和事件监听）
     * @description 应用关闭或 logout 时调用
     */
    const destroy = () => {
        stop()
        teardownVisibilityListener()
    }

    // ========================================================================
    // Initialize
    // ========================================================================
    setupVisibilityListener()

    // @returns
    return { start, stop, destroy }
}