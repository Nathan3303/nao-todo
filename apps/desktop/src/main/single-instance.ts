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
    on(event: 'second-instance', listener: () => void): unknown
}

export interface SingleInstanceOptions {
    /** 第二实例启动时聚焦首实例窗口（可注入 mock） */
    focusMainWindow?: () => void
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
    // 第二实例启动：聚焦首实例（首实例无窗口时为 no-op）
    app.on('second-instance', () => options.focusMainWindow?.())
    return true
}