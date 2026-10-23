/**
 * 重复提醒续期（纯核心，T527 / AC8 · R4）
 * @description 镜像服务端 `calculateNextRemindAt`（`nao-todo-server/domain/task/service/serviceImpl.go`）：
 *              时刻取 `remindTime`、weekly 用 `remindWeekdays` 位掩码（bit0=周日 … bit6=周六）、
 *              next **越过** `endAt` 才终止（相等仍保留，对齐服务端 `After` 语义）；
 *              monthly 仅对历史数据生效（UI 已隐藏该选项）。
 */
import { weekdaysArrayToBitmask } from '../utils/reminder-parser'
import type { ReminderTask } from './types'

/** 解析 `HH:mm`；非法/缺失 ⇒ 0 时 0 分（与 Go 侧零值回退一致） */
const parseRemindTime = (
    remindTime: string | null | undefined
): { hour: number; minute: number } => {
    if (!remindTime) return { hour: 0, minute: 0 }
    const parts = remindTime.split(':')
    if (parts.length !== 2) return { hour: 0, minute: 0 }
    const hour = Number(parts[0])
    const minute = Number(parts[1])
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return { hour: 0, minute: 0 }
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return { hour: 0, minute: 0 }
    return { hour, minute }
}

/** 本次触发时刻 ⇒ Date（接受毫秒 / ISO 串 / Date） */
const parseFiredAt = (firedAt: number | string | Date): Date =>
    firedAt instanceof Date ? firedAt : new Date(firedAt)

/** weekly 位掩码（接受位掩码或星期数组；bit0=周日） */
const toWeekdaysMask = (weekdays: ReminderTask['remindWeekdays']): number => {
    if (typeof weekdays === 'number') return weekdays
    if (Array.isArray(weekdays)) return weekdaysArrayToBitmask([...weekdays])
    return 0
}

/** 同一年月日 + 指定时刻（本地时区，与服务端 `remindAt.Location()` 一致） */
const atRemindTime = (base: Date, hour: number, minute: number): Date =>
    new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute, 0, 0)

const addDays = (base: Date, days: number): Date =>
    new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate() + days,
        base.getHours(),
        base.getMinutes(),
        0,
        0
    )

/**
 * 计算下一次提醒时间
 * @param task 任务（重复类型 / 时刻 / 星期 / 终止日期）
 * @param firedAt 本次触发时刻
 * @returns 下一次 `remindAt` 的 ISO 串；`null` = 停止重复（不重复 / 越过 endAt / weekly 无匹配日）
 */
export const nextOccurrence = (
    task: ReminderTask,
    firedAt: number | string | Date
): string | null => {
    const repeat = task.remindRepeat
    if (!repeat || repeat === 'none') return null

    const { hour, minute } = parseRemindTime(task.remindTime)
    const target = atRemindTime(parseFiredAt(firedAt), hour, minute)

    let next: Date | null = null
    switch (repeat) {
        case 'daily':
            next = addDays(target, 1)
            break
        case 'weekly': {
            const mask = toWeekdaysMask(task.remindWeekdays)
            for (let offset = 1; offset <= 7; offset += 1) {
                const candidate = addDays(target, offset)
                if ((mask & (1 << (candidate.getDay() % 7))) !== 0) {
                    next = candidate
                    break
                }
            }
            break
        }
        case 'monthly':
            // 与服务端 AddDate(0, 1, 0) 同构：目标月无该日时顺延（如 1/31 ⇒ 3/3）
            next = new Date(
                target.getFullYear(),
                target.getMonth() + 1,
                target.getDate(),
                hour,
                minute,
                0,
                0
            )
            break
        default:
            return null
    }
    if (next === null) return null

    const endAt = task.endAt ? new Date(task.endAt).getTime() : NaN
    if (Number.isFinite(endAt) && next.getTime() > endAt) return null
    return next.toISOString()
}