import { describe, expect, it } from 'vite-plus/test'
import { snapMinutes } from '../snap'

/**
 * TASK-16 吸附纯函数（ADR §4.4 / C10 / D4；PRD §5.7 冻结落点 `calendar/snap.ts`）
 * @description 同一纯函数带 `mode`：快速新建 = floor、拖拽/拉伸 = round；显示路径禁调用。
 *              分钟以「当日 00:00 起的分钟偏移」表达（15:20 = 920）。
 */
describe('snapMinutes - floor（快速新建：落格首）', () => {
    it('点 15:20（920）⇒ 15:00（900）', () => {
        expect(snapMinutes(920, 30, 'floor')).toBe(900)
    })

    it('整点/半点保持不动', () => {
        expect(snapMinutes(900, 30, 'floor')).toBe(900)
        expect(snapMinutes(930, 30, 'floor')).toBe(930)
    })

    it('向下取整到当前 30 分钟槽', () => {
        expect(snapMinutes(929, 30, 'floor')).toBe(900)
        expect(snapMinutes(0, 30, 'floor')).toBe(0)
    })
})

describe('snapMinutes - round（拖拽/拉伸：取最近 30 分钟）', () => {
    it('拖到 13:16（796）⇒ 13:30（810）', () => {
        expect(snapMinutes(796, 30, 'round')).toBe(810)
    })

    it('拉到 11:07（667）⇒ 11:00（660）', () => {
        expect(snapMinutes(667, 30, 'round')).toBe(660)
    })

    it('恰好中点取上界（Math.round 语义）', () => {
        expect(snapMinutes(885, 30, 'round')).toBe(900)
        expect(snapMinutes(884, 30, 'round')).toBe(870)
    })

    it('floor 与 round 口径不同（D4 钉死）', () => {
        expect(snapMinutes(920, 30, 'floor')).toBe(900)
        expect(snapMinutes(920, 30, 'round')).toBe(930)
        expect(snapMinutes(796, 30, 'floor')).toBe(780)
        expect(snapMinutes(796, 30, 'round')).toBe(810)
    })
})

describe('snapMinutes - step 参数化', () => {
    it('默认 step=30', () => {
        expect(snapMinutes(920, undefined, 'floor')).toBe(900)
    })

    it('step=15 时按 15 分钟吸附', () => {
        expect(snapMinutes(920, 15, 'floor')).toBe(915)
        expect(snapMinutes(920, 15, 'round')).toBe(915)
        expect(snapMinutes(923, 15, 'round')).toBe(930)
    })
})