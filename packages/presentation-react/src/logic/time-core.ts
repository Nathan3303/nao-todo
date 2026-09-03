/**
 * 时间格式化核心（纯函数，Lynx 无 dayjs 依赖风险，手动实现最小子集）
 */

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * 格式化日期时间为本地字符串
 * @param dateString ISO 字符串或 null
 * @param withTime 是否包含时间
 * @returns 格式化结果；空值返回空串
 */
export const formatDateTime = (dateString: string | null | undefined, withTime = false): string => {
    if (!dateString) return ''
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return ''
    const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    if (!withTime) return datePart
    return `${datePart} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 相对时间（中文习惯）：今天 HH:mm / 昨天 / N 天前 / 刚刚 / N 分钟前 / N 小时前
 * @param dateString ISO 字符串或 null
 * @returns 相对时间文本；空值或异常返回空串
 */
export const formatRelativeTime = (dateString: string | null | undefined): string => {
    if (!dateString) return ''
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return ''
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    // 未来时间（如提醒）：直接显示日期
    if (diffMs < 0) return formatDateTime(dateString, true)

    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour

    if (diffMs < minute) return '刚刚'
    if (diffMs < hour) return `${Math.floor(diffMs / minute)} 分钟前`
    if (diffMs < day) return `${Math.floor(diffMs / hour)} 小时前`

    // 按自然日判断
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const dayDiff = Math.round((startOfToday - startOfDate) / day)
    if (dayDiff === 0) return `今天 ${pad(date.getHours())}:${pad(date.getMinutes())}`
    if (dayDiff === 1) return '昨天'
    if (dayDiff < 7) return `${dayDiff} 天前`
    return formatDateTime(dateString)
}