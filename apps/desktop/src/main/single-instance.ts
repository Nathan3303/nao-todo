/**
 * 桌面端单实例锁（C-57 / AC16a / DEF-7）
 *
 * @description 以下状态均假设**单写者**，跨独立 Electron 进程并发会互相破坏：
 *              ① `(user_id, device_id)` 会话 upsert（重复写会话行膨胀）
 *              ② pull 游标 RMW（`syncCursor` 读改写）
 *              ③ `syncQueue` 单写者假设（SHELL-06 C-45）
 *              ④ 明文迁移竞态（T104）
 *              `navigator.locks` 仅协调**同 origin 多窗口**，跨独立 Electron 进程**无选主** ⇒
 *              必须在主进程用 `app.requestSingleInstanceLock()` 收口。
 *              第二实例：聚焦首实例窗口并立即退出（不创建窗口、不触碰数据面）。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-57）
 * @see docs/prds/2026-09-23-web-offline-stage1.md（AC16a）
 */

/**
 * 主进程 `app` 的最小依赖面
 * @description 仅声明本模块用到的三个成员 ⇒ 单测可注入 mock，无需拉起真实 Electron。
 */
export interface SingleInstanceAppLike {
    requestSingleInstanceLock(): boolean
    quit(): void
    on(event: 'second-instance', listener: (...args: unknown[]) => void): unknown
}

export interface SingleInstanceOptions {
    /**
     * 第二实例启动时把首实例窗口带到前台（可注入 mock）
     * @param cmdLine 第二实例的命令行参数（`--autostart` 那次不打扰用户，见 lifecycle）
     */
    focusMainWindow?: (cmdLine?: readonly string[]) => void
}

/**
 * 获取单实例锁；未取得则请求退出。
 * @returns `true` = 主实例（可继续创建窗口）；`false` = 第二实例（已请求退出）
 */
export const enforceSingleInstance = (
    app: SingleInstanceAppLike,
    options: SingleInstanceOptions = {}
): boolean => {
    if (!app.requestSingleInstanceLock()) {
        app.quit()
        return false
    }
    // 第二实例启动：把首实例带到前台（首实例无窗口时为 no-op）
    // 注意：隐藏窗口 `focus()` 无效 ⇒ 实际展示由 `lifecycle.handleSecondInstance` 做 show+restore+focus；
    // `--autostart` 那次不打扰用户（自启与手动启动并发，AC5）
    app.on('second-instance', (_event: unknown, cmdLine: unknown) =>
        options.focusMainWindow?.(Array.isArray(cmdLine) ? (cmdLine as string[]) : [])
    )
    return true
}