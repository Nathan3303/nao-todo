/**
 * 镜像新鲜度文案三分（C-60 / AC8 / AC9）
 * @description 互斥穷尽的三态（**不得**出现第四态、**不得**在未完整拉取时显示「数据截至 X」）：
 *              ① `'updated'`    在线 · 远端数据 ⇒「已更新」（不显示时间）；
 *              ② `'mirror'`     回退本地镜像 ⇒「离线模式 · 数据截至 {时间}」+「可能不是最新」；
 *              ③ `'incomplete'` `mirrorPulledAt` 为空/非法 或空镜像 ⇒「尚未同步完成，数据可能不完整」。
 *
 *              **负向纪律**：时间一律经 `formatMirrorPulledAt` 输出；`null` / `Invalid Date` /
 *              1970（epoch）**不得**出现在文案里 —— 非法值直接落 ③，不渲染时间。
 *              时间显示走本地时区（`toLocaleString`）。
 *
 *              纯函数 + 无框架依赖，便于单测；UI 组件只做渲染。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-60）
 */

/** 镜像新鲜度三态 */
export type MirrorFreshness = 'updated' | 'mirror' | 'incomplete'

export type ResolveFreshnessInput = {
    /** 是否处于离线（只读）态 */
    isOffline: boolean
    /** 镜像完整拉取时间（ISO；`null` = 从未成功完整拉取） */
    mirrorPulledAt: string | null
    /** 镜像是否被续拉上界截断（触顶） */
    mirrorTruncated: boolean
}

/**
 * ISO 时间是否可作为「数据截至」展示
 * @description 空值 / 不可解析 / epoch（1970-01-01T00:00:00Z，`getTime() <= 0`）一律判非法
 */
export const isValidMirrorTime = (iso: string | null | undefined): iso is string => {
    if (!iso) return false
    const time = new Date(iso).getTime()
    return Number.isFinite(time) && time > 0
}

/**
 * 解析镜像新鲜度三态（互斥穷尽）
 * @description 截断时 `mirrorPulledAt` 由引擎保证**不推进**（护栏 B）；此处再兜一层：
 *              截断 ⇒ 一律落 `'incomplete'`（**禁止**谎报「数据截至 X」）。
 */
export const resolveFreshness = (input: ResolveFreshnessInput): MirrorFreshness => {
    if (!input.isOffline) return 'updated'
    if (input.mirrorTruncated) return 'incomplete'
    return isValidMirrorTime(input.mirrorPulledAt) ? 'mirror' : 'incomplete'
}

/**
 * 格式化「数据截至」时间（本地时区）
 * @description 非法值返回 `null`（调用方不得渲染时间，转 ③ 文案）
 */
export const formatMirrorPulledAt = (iso: string | null, locale: string): string | null => {
    if (!isValidMirrorTime(iso)) return null
    const date = new Date(iso)
    const dateText = date.toLocaleDateString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    })
    const timeText = date.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit'
    })
    return `${dateText} ${timeText}`
}