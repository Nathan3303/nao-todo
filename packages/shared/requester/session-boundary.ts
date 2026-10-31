/**
 * 会话边界统一入口（`DEF-123`）—— 会话生命周期切换时「本地会话态」的**唯一清除点**
 *
 * @description `DEF-121`（重登后误报「登录已过期」）的结构性成因：会话结束类别（`sessionStorage`）
 *              的清除点分散在登录成功 / 设置页登出 / 桌面解锁门登出 / 跨标签广播接收侧 ⇒
 *              **新增任何登出或登录入口都会漏清**，靠人记不成立（PRD AC6 要求「漏清 ⇒ 测试红」）。
 *
 *              本模块把「边界清除」收敛为 1 处；各入口只允许调用 `onSessionBoundary()`。
 *              ⛔ **失效路径不受本入口管理**：会话**失效**（`10041/10042`）走
 *              `apps/web/src/session-end.ts` 的 `handleSessionEnd`，那里是
 *              **先写类别（`writeSessionEndCategory`）后清凭据**（`DEF-121` 教训）——
 *              本入口只在「主动登出 / 登录成功」这类**已结束的旧生命周期**上清除，不写类别。
 *              ⇒ 不得把本入口插到失效路径的写类别与清凭据之间。
 *
 * @see docs/prds/2026-10-31-nav-a11y-and-cleanup.md（AC5 / AC6 · R3）
 */

import { resetCheckInConflictStreak } from './checkin-window'
import { clearSessionEndReason } from './session-end-reason'

/**
 * 会话边界复位（主动登出 / 登录成功）
 * @description 两件事同源：清掉上一次的会话结束类别（下次进登录页不得误报）+ 复位检入冲突连续计数
 *              （新生命周期 ⇒ 旧计数不再作运维判据；只影响文案严重度，方向偏保守）。
 *              **幂等**：重复调用无副作用。
 */
export const onSessionBoundary = (): void => {
    clearSessionEndReason()
    resetCheckInConflictStreak()
}