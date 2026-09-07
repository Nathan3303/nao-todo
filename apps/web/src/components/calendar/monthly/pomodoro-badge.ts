/**
 * B1-F5 番茄专注徽标 - 纯逻辑模块
 * @description 与 UI/存储解耦：type=1 记录按本地日口径聚合计数、99+ 上限与显示标签、
 *              侧栏开关偏好读写（default on / 非法回退规范写回——沿用 readWeekStart 模式）。
 */

/** 角标数字上限（>99 显示 99+） */
export const POMODORO_BADGE_CAP = 99

/** 显示标签：0 不显示 / 1~99 数字 / >99 → 99+ */
export const badgeLabelOf = (count: number): string => {
    if (count <= 0) return ''
    if (count > POMODORO_BADGE_CAP) return `${POMODORO_BADGE_CAP}+`
    return String(count)
}

/** type=1 判定（番茄专注；type=2 正计时不计入口径） */
export const isTimerRound = (type: number): boolean => type === 1

/**
 * 按本地日聚合 type=1 计数（含孤儿：不按任务存在过滤——type=1 为完成快照）
 * @param records 记录（可为 store 全量）
 * @param fromKey 区间起点日期键 YYYY-MM-DD（含）
 * @param toKey 区间终点日期键 YYYY-MM-DD（含）
 * @param dayKeyOfIso 开始时刻 → 本地日键（口径注入，便于测试；生产=dayjs local format）
 * @returns dateKey → 计数（累积封顶 99+，仅显示语义；排序无关）
 */
export const countTimerRoundsByDate = (
    records: Array<{ type: number; startAt: string }>,
    fromKey: string,
    toKey: string,
    dayKeyOfIso: (startAt: string) => string
): Map<string, number> => {
    const counts = new Map<string, number>()
    for (const record of records) {
        if (!isTimerRound(record.type)) continue
        const dayKey = dayKeyOfIso(record.startAt)
        if (dayKey < fromKey || dayKey > toKey) continue
        const next = (counts.get(dayKey) ?? 0) + 1
        counts.set(dayKey, Math.min(next, POMODORO_BADGE_CAP))
    }
    return counts
}

/** 偏好存储 key（缺省=开） */
export const CALENDAR_POMODORO_BADGE_KEY = 'CALENDAR_POMODORO_BADGE'

/** 偏好读取：缺省/非法 → 开并规范写回（沿用 readWeekStart 模式） */
export const readPomodoroBadgePref = (storage: Pick<Storage, 'getItem' | 'setItem'>): boolean => {
    let raw: string | null = null
    try {
        raw = storage.getItem(CALENDAR_POMODORO_BADGE_KEY)
    } catch {
        /* 忽略 */
    }
    if (raw === 'on') return true
    if (raw === 'off') return false
    try {
        storage.setItem(CALENDAR_POMODORO_BADGE_KEY, 'on')
    } catch {
        /* 忽略 */
    }
    return true
}

/** 偏好写入 */
export const writePomodoroBadgePref = (
    storage: Pick<Storage, 'setItem'>,
    enabled: boolean
): void => {
    try {
        storage.setItem(CALENDAR_POMODORO_BADGE_KEY, enabled ? 'on' : 'off')
    } catch {
        /* 忽略 */
    }
}