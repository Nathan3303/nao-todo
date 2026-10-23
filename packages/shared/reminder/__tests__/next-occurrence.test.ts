import dayjs from 'dayjs'
import { describe, expect, it } from 'vite-plus/test'
import { nextOccurrence } from '@nao-todo/shared/reminder'
import { weekdaysArrayToBitmask } from '@nao-todo/shared/utils/reminder-parser'
import { makeTask } from './reminder-harness'

/**
 * T525 · 续期 `nextOccurrence`（AC8 · R4）
 *
 * @description 镜像服务端 `calculateNextRemindAt` 语义：时刻取 `remindTime`、weekly 用
 *              `remindWeekdays` 位掩码、next **越过** `endAt` 则清空并停止（相等仍保留，
 *              对齐 ADR 2026-09-21 D3「越过」口径）；monthly 仅历史数据。
 * @see ../__tests__/reminder-harness.ts（契约总表）
 */

/** 本地时刻构造（用例全部用本地时区，避免机器时区差异影响 `remindTime`） */
const localAt = (year: number, month1: number, day: number, hour: number, minute = 0): Date =>
    new Date(year, month1 - 1, day, hour, minute, 0, 0)

describe('nextOccurrence · 不重复（R4）', () => {
    it('remindRepeat = none / 空 ⇒ null（停止重复）', () => {
        expect(
            nextOccurrence(makeTask({ id: 'a', remindRepeat: 'none' }), localAt(2026, 10, 23, 9))
        ).toBeNull()
        expect(
            nextOccurrence(makeTask({ id: 'b', remindRepeat: null }), localAt(2026, 10, 23, 9))
        ).toBeNull()
    })
})

describe('nextOccurrence · daily（AC8）', () => {
    it('firedAt 当日 09:00 ⇒ 次日 09:00（同一 remindTime，晚一天）', () => {
        const firedAt = localAt(2026, 10, 23, 9)
        const task = makeTask({ id: 'd1', remindRepeat: 'daily', remindTime: '09:00' })

        const next = nextOccurrence(task, firedAt)

        expect(next).not.toBeNull()
        expect(dayjs(next!).isAfter(firedAt)).toBe(true)
        expect(dayjs(next!).format('HH:mm')).toBe('09:00')
        expect(dayjs(next!).diff(firedAt, 'day')).toBe(1)
    })

    it('过期很久后的补弹（firedAt 晚于 remindTime）仍推进到下一个未来时刻，不得回退到过去', () => {
        const firedAt = localAt(2026, 10, 26, 15, 30)
        const task = makeTask({ id: 'd2', remindRepeat: 'daily', remindTime: '09:00' })

        const next = nextOccurrence(task, firedAt)

        expect(next).not.toBeNull()
        expect(dayjs(next!).isAfter(firedAt)).toBe(true)
        expect(dayjs(next!).format('HH:mm')).toBe('09:00')
    })
})

describe('nextOccurrence · weekly（AC8，位掩码）', () => {
    it('firedAt 为周五 09:00、weekdays = 周一 ⇒ 下一个周一 09:00', () => {
        const firedAt = localAt(2026, 10, 23, 9) // 2026-10-23 = 周五
        expect(dayjs(firedAt).day()).toBe(5)
        const task = makeTask({
            id: 'w1',
            remindRepeat: 'weekly',
            remindTime: '09:00',
            remindWeekdays: weekdaysArrayToBitmask([1]) // 1 = 周一
        })

        const next = nextOccurrence(task, firedAt)

        expect(next).not.toBeNull()
        expect(dayjs(next!).isAfter(firedAt)).toBe(true)
        expect(dayjs(next!).day()).toBe(1)
        expect(dayjs(next!).format('HH:mm')).toBe('09:00')
        expect(dayjs(next!).diff(firedAt, 'day')).toBeLessThanOrEqual(7)
    })
})

describe('nextOccurrence · monthly（AC8，仅历史数据）', () => {
    it('firedAt = 1 月 15 日 09:00 ⇒ 2 月 15 日 09:00', () => {
        const firedAt = localAt(2026, 1, 15, 9)
        const task = makeTask({ id: 'm1', remindRepeat: 'monthly', remindTime: '09:00' })

        const next = nextOccurrence(task, firedAt)

        expect(next).not.toBeNull()
        expect(dayjs(next!).month()).toBe(1) // 0 基：1 = 2 月
        expect(dayjs(next!).date()).toBe(15)
        expect(dayjs(next!).format('HH:mm')).toBe('09:00')
    })
})

describe('nextOccurrence · endAt 终止（AC8）', () => {
    const firedAt = localAt(2026, 10, 23, 9)
    const daily = (endAt: string | null) =>
        makeTask({ id: 'e1', remindRepeat: 'daily', remindTime: '09:00', endAt })

    it('next 晚于 endAt ⇒ null（清空并停止重复）', () => {
        const endAt = dayjs(firedAt).add(12, 'hour').toISOString()

        expect(nextOccurrence(daily(endAt), firedAt)).toBeNull()
    })

    it('next 早于 endAt ⇒ 返回下一次', () => {
        const endAt = dayjs(firedAt).add(2, 'day').toISOString()

        expect(nextOccurrence(daily(endAt), firedAt)).not.toBeNull()
    })

    it('next 恰等于 endAt ⇒ 保留（「越过」才终止，对齐服务端 After 语义）', () => {
        const nextIso = dayjs(firedAt).add(1, 'day').toISOString()

        expect(nextOccurrence(daily(nextIso), firedAt)).not.toBeNull()
    })
})