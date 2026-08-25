/**
 * 日期选择核心（纯函数，供 date-picker-sheet 使用）
 * @description Lynx 无原生日期选择组件（无 picker 元素、无系统日期模块），
 *              自绘 Sheet 选择器：快捷项 + 年/月/日/时/分步进微调。
 *              输入输出均为 ISO 字符串（与任务 startAt/endAt 字段一致）。
 */

/** 快捷选择项 */
export type DateQuickOption = 'today' | 'tomorrow' | 'week-sunday' | 'week-monday' | 'clear'

/** 步进字段 */
export type DateField = 'year' | 'month' | 'day' | 'hour' | 'minute'

export type DatePickerValue = {
    year: number
    month: number // 1-12
    day: number // 1-31
    hour: number // 0-23
    minute: number // 0-59
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** 当前时间 → 选择值（默认现在） */
export const nowToValue = (now: Date = new Date()): DatePickerValue => ({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes()
})

/** ISO 字符串 → 选择值；空/非法 → 默认现在 */
export const isoToValue = (
    iso: string | null | undefined,
    now: Date = new Date()
): DatePickerValue => {
    if (!iso) return nowToValue(now)
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return nowToValue(now)
    return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hour: date.getHours(),
        minute: date.getMinutes()
    }
}

/** 选择值 → ISO 字符串（本地时区，与任务字段一致） */
export const valueToIso = (value: DatePickerValue): string => {
    const date = new Date(value.year, value.month - 1, value.day, value.hour, value.minute)
    return date.toISOString()
}

/** 显示文本（2026-06-01 09:30） */
export const valueToText = (value: DatePickerValue, withTime = true): string =>
    `${value.year}-${pad(value.month)}-${pad(value.day)}${withTime ? ` ${pad(value.hour)}:${pad(value.minute)}` : ''}`

/** 某月天数（处理闰年） */
export const daysInMonth = (year: number, month: number): number =>
    new Date(year, month, 0).getDate()

/** 步进微调（自动归一化：跨月/跨年、闰年） */
export const stepValue = (
    value: DatePickerValue,
    field: DateField,
    delta: number
): DatePickerValue => {
    const next = { ...value }
    switch (field) {
        case 'year':
            next.year = value.year + delta
            break
        case 'month': {
            const total = value.year * 12 + (value.month - 1) + delta
            next.year = Math.floor(total / 12)
            next.month = (((total % 12) + 12) % 12) + 1
            break
        }
        case 'day': {
            const date = new Date(value.year, value.month - 1, value.day + delta)
            next.year = date.getFullYear()
            next.month = date.getMonth() + 1
            next.day = date.getDate()
            break
        }
        case 'hour':
            next.hour = (value.hour + delta + 24) % 24
            break
        case 'minute':
            next.minute = (value.minute + delta + 60) % 60
            break
    }
    // 天归一化（如 1/31 +1 月 → 2/28）
    const maxDay = daysInMonth(next.year, next.month)
    if (next.day > maxDay) next.day = maxDay
    return next
}

/** 应用快捷项（返回新值；'clear' 返回 null 表示清空） */
export const applyQuickOption = (
    value: DatePickerValue,
    option: DateQuickOption
): DatePickerValue | null => {
    const now = new Date()
    switch (option) {
        case 'today':
            return { ...nowToValue(now), hour: value.hour, minute: value.minute }
        case 'tomorrow': {
            const tomorrow = new Date(now)
            tomorrow.setDate(tomorrow.getDate() + 1)
            return { ...nowToValue(tomorrow), hour: value.hour, minute: value.minute }
        }
        case 'week-sunday': {
            const sunday = new Date(now)
            sunday.setDate(now.getDate() + ((7 - now.getDay()) % 7))
            const v = nowToValue(sunday)
            return { ...v, hour: value.hour, minute: value.minute }
        }
        case 'week-monday': {
            const monday = new Date(now)
            const diff = (7 - now.getDay() + 1) % 7
            monday.setDate(now.getDate() + diff)
            const v = nowToValue(monday)
            return { ...v, hour: value.hour, minute: value.minute }
        }
        case 'clear':
            return null
    }
}