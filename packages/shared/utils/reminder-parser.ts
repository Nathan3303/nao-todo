const remindRepeatSNMap: Record<string, number> = {
    none: 0,
    daily: 1,
    weekly: 2,
    monthly: 3
}

const remindRepeatSNMapReverse: string[] = ['none', 'daily', 'weekly', 'monthly']

export const parseRemindRepeat = (repeatString: string): number => {
    return remindRepeatSNMap[repeatString] ?? 0
}

export const parseRemindRepeatBackward = (repeatNumber: number): string => {
    return remindRepeatSNMapReverse[repeatNumber] || 'none'
}

/**
 * 将 weekday 数组转换为位掩码
 * weekday 值：1=周一 2=周二 3=周三 4=周四 5=周五 6=周六 7=周日
 * bit 位置：bit0=周日 bit1=周一 ... bit6=周六（即 day % 7）
 */
export const weekdaysArrayToBitmask = (days: number[]): number => {
    let mask = 0
    for (const d of days) {
        mask |= 1 << (d % 7)
    }
    return mask
}

/**
 * 将位掩码转换为 weekday 数组
 * bit0→7(周日) bit1→1(周一) bit2→2(周二) ... bit6→6(周六)
 */
export const bitmaskToWeekdaysArray = (mask: number): number[] => {
    const days: number[] = []
    for (let pos = 0; pos < 7; pos++) {
        if (mask & (1 << pos)) {
            days.push(pos === 0 ? 7 : pos)
        }
    }
    return days.sort((a, b) => a - b)
}
