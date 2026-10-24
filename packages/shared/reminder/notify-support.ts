/**
 * 系统通知能力降级标记（T531 · AC9 / C3）
 *
 * @description 权限 **`granted`** 但真实发送「未送达」（Android Chrome 页面通知被禁用）⇒
 *              写一次**设备级**标记（`REMINDER_NOTIFY_UNSUPPORTED`）：
 *              - 设置区据此显示「不支持」并置灰声音开关（走既有 `soundAvailable` / `soundHintKey`）；
 *              - 设备级 ⇒ 登出不清、刷新仍在（能力属本浏览器，不是账号属性）；
 *              - **幂等**：已有标记即不再写（避免每次未送达都重复写存储）；
 *              - 读写**永不抛**（隐私模式 / 配额满 ⇒ 静默降级，不影响派发）。
 * @see docs/prds/2026-10-24-reminder-settings.md（§七 AC9）
 * @see docs/reports/T530-arch-review.md（§6.1 能力判定：真实发送兜底）
 */
import { REMINDER_NOTIFY_UNSUPPORTED_KEY } from '../constants/storage-keys'
import type { ReminderSettingsStorage } from './reminder-settings'

/** 标记值（只表达「有标记」，不承载时间/次数） */
export const NOTIFY_UNSUPPORTED_MARKER = '1'

/** 是否已记录「通知发不出」降级标记（不可用 ⇒ false） */
export const hasNotifyUnsupported = (storage?: ReminderSettingsStorage | null): boolean => {
    if (!storage) return false
    try {
        return storage.getItem(REMINDER_NOTIFY_UNSUPPORTED_KEY) !== null
    } catch {
        return false
    }
}

/**
 * 记录「通知发不出」降级标记（幂等 · 永不抛）
 * @param storage 存储面（不可用 ⇒ 静默失败：本会话仍由设置区内存态兜底）
 */
export const markNotifyUnsupported = (storage?: ReminderSettingsStorage | null): void => {
    if (!storage) return
    try {
        if (storage.getItem(REMINDER_NOTIFY_UNSUPPORTED_KEY) !== null) return
        storage.setItem(REMINDER_NOTIFY_UNSUPPORTED_KEY, NOTIFY_UNSUPPORTED_MARKER)
    } catch {
        /* 配额满 / 隐私模式：静默降级 */
    }
}