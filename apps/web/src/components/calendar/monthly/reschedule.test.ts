import { describe, expect, it } from 'vite-plus/test'
import dayjs from 'dayjs'
import {
    endOfDayIsoOf,
    isValidDateKey,
    shiftTaskDates,
    snapshotTaskDates,
    type TaskScheduleFields
} from './reschedule'

/** 本地墙钟口径的断言辅助（与 T1「保留时刻 HH:mm:ss.SSS」语义一致） */
const localDay = (iso: string): string => dayjs(iso).format('YYYY-MM-DD')
const localTime = (iso: string): string => dayjs(iso).format('HH:mm:ss.SSS')

/** 目标日末的本地表示（23:59:59.999 当天） */
const DAY_END_TIME = '23:59:59.999'

/** 单日任务字段（本地无时区后缀字符串，断言与运行环境时区无关） */
const sameDayTask = (day: string, start: string, end: string): TaskScheduleFields => ({
    startAt: `${day}T${start}`,
    endAt: `${day}T${end}`
})

const blank = (): TaskScheduleFields => ({ startAt: null, endAt: null })

describe('shiftTaskDates - T1 改期统一语义', () => {
    it('未安排（无 startAt/endAt）：endAt 直写目标日末、startAt 保持空且不参与上送', () => {
        const patch = shiftTaskDates(blank(), '2026-10-05')
        expect(patch).not.toBeNull()
        expect(patch!.startAt).toBeUndefined()
        expect(localDay(patch!.endAt!)).toBe('2026-10-05')
        expect(localTime(patch!.endAt!)).toBe(DAY_END_TIME)
    })

    it('未安排仅 startAt：endAt 直写目标日末、startAt 保持不动（B7 等价）', () => {
        const fields: TaskScheduleFields = { startAt: '2026-10-06T09:30:00', endAt: null }
        const patch = shiftTaskDates(fields, '2026-10-09')
        expect(patch).not.toBeNull()
        expect(patch!.startAt).toBeUndefined() // 未变化不重写
        expect(localDay(patch!.endAt!)).toBe('2026-10-09')
        expect(localTime(patch!.endAt!)).toBe('23:59:59.999')
    })

    it('目标日早于 startAt 所在日：仍为 B7 直写语义（先后关系交由领域守卫拒绝，纯函数不裁决）', () => {
        const fields: TaskScheduleFields = { startAt: '2026-10-09T09:00:00', endAt: '' }
        const patch = shiftTaskDates(fields, '2026-10-05')
        expect(patch).not.toBeNull()
        expect(localDay(patch!.endAt!)).toBe('2026-10-05')
        expect(patch!.startAt).toBeUndefined()
    })

    it('已排期但无 startAt（仅 endAt）：endAt 直写目标日末、startAt 保持空', () => {
        const fields: TaskScheduleFields = { startAt: '', endAt: '2026-10-05T18:00:00' }
        const patch = shiftTaskDates(fields, '2026-10-08')
        expect(patch).not.toBeNull()
        expect(patch!.startAt).toBeUndefined()
        expect(localDay(patch!.endAt!)).toBe('2026-10-08')
        expect(localTime(patch!.endAt!)).toBe('23:59:59.999')
    })

    it('单日任务（09:00–18:00）平移 Δ=+3：时刻与时长保留', () => {
        const patch = shiftTaskDates(
            sameDayTask('2026-10-05', '09:00:00.000', '18:00:00.000'),
            '2026-10-08'
        )
        expect(patch).not.toBeNull()
        expect(localDay(patch!.startAt!)).toBe('2026-10-08')
        expect(localTime(patch!.startAt!)).toBe('09:00:00.000')
        expect(localDay(patch!.endAt!)).toBe('2026-10-08')
        expect(localTime(patch!.endAt!)).toBe('18:00:00.000')
    })

    it('Δ=+1 月末边界：10-31 → 11-01，时刻保留', () => {
        const patch = shiftTaskDates(
            sameDayTask('2026-10-31', '09:00:00.000', '18:00:00.000'),
            '2026-11-01'
        )
        expect(patch).not.toBeNull()
        expect(localDay(patch!.startAt!)).toBe('2026-11-01')
        expect(localTime(patch!.startAt!)).toBe('09:00:00.000')
        expect(localDay(patch!.endAt!)).toBe('2026-11-01')
        expect(localTime(patch!.endAt!)).toBe('18:00:00.000')
    })

    it('Δ=+7 下周同日：日期同步 +7、HH:mm 保留', () => {
        const patch = shiftTaskDates(
            sameDayTask('2026-10-05', '09:00:00.000', '18:00:00.000'),
            '2026-10-12'
        )
        expect(patch).not.toBeNull()
        expect(localDay(patch!.startAt!)).toBe('2026-10-12')
        expect(localDay(patch!.endAt!)).toBe('2026-10-12')
        expect(localTime(patch!.startAt!)).toBe('09:00:00.000')
        expect(localTime(patch!.endAt!)).toBe('18:00:00.000')
    })

    it('跨日任务平移：日历日跨度（3 天）保持、起止时刻保留', () => {
        const fields: TaskScheduleFields = {
            startAt: '2026-10-01T22:00:00.000',
            endAt: '2026-10-03T08:00:00.000'
        }
        const patch = shiftTaskDates(fields, '2026-10-10')
        expect(patch).not.toBeNull()
        expect(localDay(patch!.startAt!)).toBe('2026-10-08')
        expect(localTime(patch!.startAt!)).toBe('22:00:00.000')
        expect(localDay(patch!.endAt!)).toBe('2026-10-10')
        expect(localTime(patch!.endAt!)).toBe('08:00:00.000')
    })

    it('目标日 = 原 endAt 所在日（Δ=0）：endAt 原样返回、startAt 不再上送', () => {
        const fields = sameDayTask('2026-10-05', '09:00:00.000', '18:00:00.000')
        const patch = shiftTaskDates(fields, '2026-10-05')
        expect(patch).not.toBeNull()
        expect(patch!.startAt).toBeUndefined()
        expect(patch!.endAt).toBe(fields.endAt)
    })

    it('已排期任务平移到过去日期：Δ 为负同样成立（逾期语义由视图口径呈现）', () => {
        const patch = shiftTaskDates(
            sameDayTask('2026-10-10', '09:00:00.000', '18:00:00.000'),
            '2026-10-01'
        )
        expect(patch).not.toBeNull()
        expect(localDay(patch!.startAt!)).toBe('2026-10-01')
        expect(localDay(patch!.endAt!)).toBe('2026-10-01')
        expect(localTime(patch!.startAt!)).toBe('09:00:00.000')
    })

    it('目标日键非法（越界/杂字符/空串）→ null（拒绝/不改）', () => {
        const fields = blank()
        expect(shiftTaskDates(fields, '2026-13-01')).toBeNull()
        expect(shiftTaskDates(fields, '2026-00-10')).toBeNull()
        expect(shiftTaskDates(fields, '2026-10-32')).toBeNull()
        expect(shiftTaskDates(fields, '2026-02-29')).toBeNull() // 非闰年
        expect(shiftTaskDates(fields, '10/05/2026')).toBeNull()
        expect(shiftTaskDates(fields, '')).toBeNull()
        expect(shiftTaskDates(fields, 'garbage')).toBeNull()
    })

    it('endOfDayIsoOf：目标日末为本地 23:59:59.999（不跨日）', () => {
        expect(isValidDateKey('2026-10-05')).toBe(true)
        expect(isValidDateKey('2026-2-5')).toBe(false)
        const iso = endOfDayIsoOf('2026-10-05')
        expect(localDay(iso)).toBe('2026-10-05')
        expect(localTime(iso)).toBe('23:59:59.999')
    })
})

describe('snapshotTaskDates - U2 撤销快照', () => {
    it('原样捕获前值（含空值形态，清空语义回空串而非 null）', () => {
        const snap = snapshotTaskDates({ id: 't1', startAt: '2026-10-05T09:00:00', endAt: '' })
        expect(snap).toEqual({ id: 't1', prevStartAt: '2026-10-05T09:00:00', prevEndAt: '' })
    })

    it('空值空串与 null 均原样保留（DEF-1：还原清空上送空串）', () => {
        const snapA = snapshotTaskDates({ id: 't1', startAt: null, endAt: '' })
        expect(snapA.prevStartAt).toBeNull()
        expect(snapA.prevEndAt).toBe('')
        const snapB = snapshotTaskDates({ id: 't2', startAt: null, endAt: null })
        expect(snapB.prevEndAt).toBeNull()
    })
})