/**
 * 登录设备「最近活跃」时间分档（T535 · R3）
 * @description 纯函数（无框架、无 i18n 依赖）⇒ 阈值可单测。分档（`diff = now - t`）：
 *              `<1 分钟`（含时钟偏差的未来时间）⇒ justNow ·
 *              `<1 小时` ⇒ N 分钟 ·
 *              `<24 小时` ⇒ N 小时 ·
 *              `<48 小时` ⇒ yesterday（昨天）·
 *              `<7 天` ⇒ N 天 ·
 *              `≥7 天` ⇒ 回落日期。
 *              文案本地化由调用方承担（justNow / yesterday 走 i18n 键，N 分钟/小时/天 走
 *              `Intl.RelativeTimeFormat`，英文单复数与中文量词由 ICU 处理）。
 */

/** 分档结果（`null` = 时间缺失/非法，调用方不得渲染时间） */
export type SessionActiveAt =
    | { kind: 'justNow' }
    | { kind: 'yesterday' }
    | { kind: 'relative'; amount: number; unit: 'minute' | 'hour' | 'day' }
    | { kind: 'date'; date: Date }

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * 解析「最近活跃」时间分档
 * @param iso 会话 `updatedAt`（RFC3339；`null`/空串亦可）
 * @param now 当前时间戳（毫秒，默认 `Date.now()`；测试注入固定值）
 */
export const resolveSessionActiveAt = (
    iso: string | null | undefined,
    now: number = Date.now()
): SessionActiveAt | null => {
    if (!iso) return null
    const time = new Date(iso).getTime()
    if (!Number.isFinite(time)) return null

    const diff = now - time
    // 未来时间（设备间时钟偏差）按「刚刚」处理，不显示负数
    if (diff < MINUTE) return { kind: 'justNow' }
    if (diff < HOUR) return { kind: 'relative', amount: Math.floor(diff / MINUTE), unit: 'minute' }
    if (diff < DAY) return { kind: 'relative', amount: Math.floor(diff / HOUR), unit: 'hour' }
    if (diff < 2 * DAY) return { kind: 'yesterday' }
    if (diff < 7 * DAY) return { kind: 'relative', amount: Math.floor(diff / DAY), unit: 'day' }
    return { kind: 'date', date: new Date(time) }
}