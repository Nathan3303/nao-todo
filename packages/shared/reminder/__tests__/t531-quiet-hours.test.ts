import { describe, expect, it } from 'vite-plus/test'
import { isWithinQuietHours, normalizeQuietHours } from '@nao-todo/shared/reminder'
import type { QuietHoursRange } from '@nao-todo/shared/reminder'

/**
 * T531 · 免打扰区间判定（AC6 · 纯函数接缝，红基线）
 *
 * 契约（RD 按此实现，`packages/shared/reminder/quiet-hours.ts` + barrel 导出）：
 *
 * ```ts
 * export type QuietHoursRange = { start: string; end: string } // 'HH:mm'（24 小时制）
 * export const normalizeQuietHours: (raw: unknown) => QuietHoursRange | null
 * export const isWithinQuietHours: (
 *     nowMs: number,
 *     quietHours: QuietHoursRange | null | undefined
 * ) => boolean
 * ```
 *
 * 口径（PRD §五 R1 / §六 NFR / 架构报告 §3.2）：
 * - **半开区间 `[start, end)`**：含起点、**不含终点**（22:00–08:00 ⇒ 08:00:00 整即放行）；
 * - **允许跨天**：`start > end` = 跨天（如 22:00–08:00），`start < end` = 同日段；
 *   注：PRD v1.0 的「倒序 = 非法」已由 T530 终签 **C1** 作废 —— 跨天是**合法**表达；
 * - `start === end` ⇒ 视为关闭（= 不抑制）；**非法**仅指格式错 / 越界 / 缺字段 / 起止相等；
 * - 判定粒度 = **分钟**（`07:59:59.999` 仍静默、`08:00:00.000` 放行）；
 * - 时钟 = **设备本地墙钟**（入参是校准后 epoch ms ⇒ 内部用本地 `Date` 分量）；
 * - 缺失 / 非法（格式错、缺字段、类型不符）⇒ **fail-open**（返回 false，**绝不抛错**）。
 *
 * ⚠️ 时间构造一律 `new Date(y, m, d, H, M)` **本地墙钟**，禁 UTC ISO 字面量（DEF-81）：
 * 否则用例只在本机时区绿，CI（UTC）必红。
 *
 * @see docs/prds/2026-10-24-reminder-settings.md §五 R1 · §七 AC6
 */

/** 本地墙钟毫秒（2026-10-24 为基准日，跨天用例用 25 日） */
const at = (day: 24 | 25, hour: number, minute: number, second = 0, ms = 0): number =>
    new Date(2026, 9, day, hour, minute, second, ms).getTime()

const OVERNIGHT: QuietHoursRange = { start: '22:00', end: '08:00' }
const SAMEDAY: QuietHoursRange = { start: '12:00', end: '13:00' }

describe('T531 · AC6 normalizeQuietHours（配置归一 / fail-open）', () => {
    it('AC6 合法单段 ⇒ 原样返回', () => {
        expect(normalizeQuietHours({ start: '22:00', end: '08:00' })).toEqual(OVERNIGHT)
        expect(normalizeQuietHours({ start: '00:00', end: '23:59' })).toEqual({
            start: '00:00',
            end: '23:59'
        })
    })

    it('C1 start > end 是**合法跨天**表达，不得判为「倒序非法」', () => {
        // PRD v1.0「倒序 = 非法」已作废（T530 终签 C1）：唯一合法解读 = 跨天段。
        expect(normalizeQuietHours({ start: '23:30', end: '06:15' })).toEqual({
            start: '23:30',
            end: '06:15'
        })
        expect(normalizeQuietHours({ start: '22:00', end: '08:00' })).not.toBeNull()
    })

    it('AC6 缺省 / null / 空对象 ⇒ null（= 免打扰关闭）', () => {
        expect(normalizeQuietHours(null)).toBeNull()
        expect(normalizeQuietHours(undefined)).toBeNull()
        expect(normalizeQuietHours({})).toBeNull()
        expect(normalizeQuietHours({ start: '22:00' })).toBeNull()
        expect(normalizeQuietHours({ end: '08:00' })).toBeNull()
    })

    it('AC6 start === end ⇒ null（配置事故，按关闭处理）', () => {
        expect(normalizeQuietHours({ start: '08:00', end: '08:00' })).toBeNull()
        expect(normalizeQuietHours({ start: '00:00', end: '00:00' })).toBeNull()
    })

    it('AC6 非法时刻 ⇒ null（25:00 / 22:60 / 非零填充 / 空串 / 非字符串）', () => {
        expect(normalizeQuietHours({ start: '25:00', end: '08:00' })).toBeNull()
        expect(normalizeQuietHours({ start: '22:60', end: '08:00' })).toBeNull()
        expect(normalizeQuietHours({ start: '7:00', end: '08:00' })).toBeNull()
        expect(normalizeQuietHours({ start: '', end: '08:00' })).toBeNull()
        expect(normalizeQuietHours({ start: 22, end: 8 })).toBeNull()
        expect(normalizeQuietHours({ start: '22:00', end: ['08:00'] })).toBeNull()
    })

    it('C1 非法集不含「跨天」：仅格式错 / 缺字段 / start === end', () => {
        const LEGAL = [
            { start: '22:00', end: '08:00' },
            { start: '23:30', end: '06:15' },
            { start: '08:00', end: '22:00' }
        ]
        for (const range of LEGAL) expect(normalizeQuietHours(range)).not.toBeNull()

        const ILLEGAL = [
            { start: '25:00', end: '08:00' },
            { start: '22:00', end: '24:00' },
            { start: 'abc', end: '08:00' },
            { start: '09:00' },
            { start: '09:00', end: '09:00' }
        ]
        for (const range of ILLEGAL) expect(normalizeQuietHours(range)).toBeNull()
    })

    it('AC6 任意脏输入（数字 / 数组 / 字符串 / 深层嵌套）⇒ null 且不抛错', () => {
        const dirty: unknown[] = [0, 1, '22:00-08:00', [], [{ start: '22:00' }], true, () => {}]
        for (const raw of dirty) {
            expect(() => normalizeQuietHours(raw)).not.toThrow()
            expect(normalizeQuietHours(raw)).toBeNull()
        }
    })
})

describe('T531 · AC6 isWithinQuietHours 跨天段（22:00–08:00）', () => {
    it('AC6 起点当刻即静默（含起点）', () => {
        expect(isWithinQuietHours(at(24, 22, 0), OVERNIGHT)).toBe(true)
    })

    it('AC6 起点之前 1 秒放行', () => {
        expect(isWithinQuietHours(at(24, 21, 59, 59), OVERNIGHT)).toBe(false)
    })

    it('AC6 段内三刻（23:59 / 00:00 / 07:59）静默', () => {
        expect(isWithinQuietHours(at(24, 23, 59), OVERNIGHT)).toBe(true)
        expect(isWithinQuietHours(at(25, 0, 0), OVERNIGHT)).toBe(true)
        expect(isWithinQuietHours(at(25, 7, 59), OVERNIGHT)).toBe(true)
    })

    it('AC6 终点当刻放行（不含终点：08:00:00 整）', () => {
        expect(isWithinQuietHours(at(25, 8, 0, 0, 0), OVERNIGHT)).toBe(false)
    })

    it('AC6 终点前 1 毫秒仍静默（分钟粒度下沿）', () => {
        expect(isWithinQuietHours(at(25, 7, 59, 59, 999), OVERNIGHT)).toBe(true)
    })

    it('AC6 段外（12:00 / 21:00 / 09:00）放行', () => {
        expect(isWithinQuietHours(at(24, 12, 0), OVERNIGHT)).toBe(false)
        expect(isWithinQuietHours(at(24, 21, 0), OVERNIGHT)).toBe(false)
        expect(isWithinQuietHours(at(25, 9, 0), OVERNIGHT)).toBe(false)
    })
})

describe('T531 · AC6 isWithinQuietHours 同日段（12:00–13:00）', () => {
    it('AC6 起点静默、终点放行、段外放行', () => {
        expect(isWithinQuietHours(at(24, 12, 0), SAMEDAY)).toBe(true)
        expect(isWithinQuietHours(at(24, 12, 59), SAMEDAY)).toBe(true)
        expect(isWithinQuietHours(at(24, 13, 0), SAMEDAY)).toBe(false)
        expect(isWithinQuietHours(at(24, 11, 59), SAMEDAY)).toBe(false)
    })

    it('AC6 同日段不得跨天误判（次日 12:00 前放行）', () => {
        expect(isWithinQuietHours(at(25, 0, 30), SAMEDAY)).toBe(false)
        expect(isWithinQuietHours(at(25, 12, 30), SAMEDAY)).toBe(true)
    })
})

describe('T531 · AC6 isWithinQuietHours 缺省与非法（fail-open）', () => {
    it('AC6 null / undefined / 未配置 ⇒ 不抑制（false）', () => {
        expect(isWithinQuietHours(at(24, 23, 0), null)).toBe(false)
        expect(isWithinQuietHours(at(24, 23, 0), undefined)).toBe(false)
    })

    it('AC6 非法配置（运行期脏数据）⇒ 不抑制且不抛错', () => {
        const dirty = [
            { start: '25:00', end: '08:00' },
            { start: '08:00', end: '08:00' },
            { start: 'abc', end: '08:00' }
        ] as unknown as QuietHoursRange[]

        for (const range of dirty) {
            expect(() => isWithinQuietHours(at(24, 23, 0), range)).not.toThrow()
            expect(isWithinQuietHours(at(24, 23, 0), range)).toBe(false)
        }
    })

    it('AC6 非数值 nowMs ⇒ 不抛错（防御，按不抑制处理）', () => {
        expect(() => isWithinQuietHours(Number.NaN, OVERNIGHT)).not.toThrow()
        expect(isWithinQuietHours(Number.NaN, OVERNIGHT)).toBe(false)
    })

    it('AC6 单段模型：数组形态（多段）不参与判定、不抛错（PRD 非范围）', () => {
        const multi = [OVERNIGHT, SAMEDAY] as unknown as QuietHoursRange
        expect(() => isWithinQuietHours(at(24, 12, 30), multi)).not.toThrow()
        expect(isWithinQuietHours(at(24, 12, 30), multi)).toBe(false)
    })
})

describe('T531 · 负向闭环（判定不得「恒静默」/「恒放行」）', () => {
    it('AC6 同一配置在不同时刻给出不同结论（防恒值实现）', () => {
        const results = [at(24, 22, 30), at(25, 7, 0), at(25, 8, 0), at(24, 12, 0)].map((ms) =>
            isWithinQuietHours(ms, OVERNIGHT)
        )
        expect(results).toEqual([true, true, false, false])
    })

    it('AC6 跨天段与「同值反向段」结论相反（防把 start/end 写反）', () => {
        const night: QuietHoursRange = { start: '22:00', end: '08:00' }
        const day: QuietHoursRange = { start: '08:00', end: '22:00' }
        for (const ms of [at(24, 23, 0), at(25, 3, 0), at(24, 12, 0), at(24, 21, 0)]) {
            expect(isWithinQuietHours(ms, night)).toBe(!isWithinQuietHours(ms, day))
        }
    })
})