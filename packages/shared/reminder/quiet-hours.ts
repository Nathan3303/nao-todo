/**
 * 免打扰区间判定（T531 · AC6 · 纯函数接缝）
 *
 * @description 单段半开区间 `[start, end)`，**可跨天**（`start > end` 合法）：
 *              - `start === end` ⇒ 视为关闭（配置事故，按关闭处理）；
 *              - 非法仅指格式错 / 越界 / 缺字段 / 类型不符 ⇒ **fail-open**（不抑制、不抛错）；
 *              - 粒度 = 分钟（`07:59:59.999` 仍静默、`08:00:00.000` 放行）；
 *              时钟 = 入参 epoch ms 的**设备本地墙钟**（与校准后 `now()` 同源，PRD §五 R9）。
 * @see docs/prds/2026-10-24-reminder-settings.md（§五 R1 / §七 AC6）
 * @see docs/adr/2026-10-24-reminder-settings-quiet-hours.md（决策 2）
 */

/** 免打扰时段（`HH:mm`，24 小时制，首位补零） */
export type QuietHoursRange = {
    start: string
    end: string
}

/** 严格 `HH:mm`（`7:00` / `25:00` / `22:60` 均不合法） */
const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

/** `HH:mm` ⇒ 当日分钟数 */
const toMinutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))

/**
 * 归一化免打扰配置
 * @param raw 任意来源（本地存储 / 远端快照 / 表单）
 * @returns 合法区间（含跨天）或 `null`（= 关闭；缺失、非法、`start === end` 一律归 `null`）
 */
export const normalizeQuietHours = (raw: unknown): QuietHoursRange | null => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const { start, end } = raw as { start?: unknown; end?: unknown }
    if (typeof start !== 'string' || typeof end !== 'string') return null
    if (!HH_MM_PATTERN.test(start) || !HH_MM_PATTERN.test(end)) return null
    if (start === end) return null
    return { start, end }
}

/**
 * 当前时刻是否处于免打扰时段
 * @param nowMs 校准后的本机毫秒时间戳（按设备本地墙钟取 `HH:mm`）
 * @param quietHours 免打扰配置（缺失 / 非法 ⇒ 不抑制）
 */
export const isWithinQuietHours = (nowMs: number, quietHours?: QuietHoursRange | null): boolean => {
    if (typeof nowMs !== 'number' || !Number.isFinite(nowMs)) return false
    const range = normalizeQuietHours(quietHours)
    if (!range) return false
    const date = new Date(nowMs)
    const current = date.getHours() * 60 + date.getMinutes()
    const start = toMinutes(range.start)
    const end = toMinutes(range.end)
    return start > end
        ? current >= start || current < end // 跨天（如 22:00–08:00）
        : current >= start && current < end // 同日段
}