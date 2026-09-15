// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import dayjs from 'dayjs'
import CalendarMonthGrid from '../calendar-month-grid.vue'
import { monthFirstDateKey } from '../month-jump'

/**
 * TASK-09 年-月跳转网格（month-jump-panel 内容迁移）
 * @description 年区 ±1 步进 + 12 月格 + 今天年月高亮；月格 data-executeid = "YYYY-MM-01"
 *              （经 NueDropdown execute 委托上抛）；打开（active）时可视年复位到锚点年。
 */

const mountGrid = (props: { anchorYear?: number; active?: boolean } = {}): VueWrapper =>
    mount(CalendarMonthGrid, {
        attachTo: document.body,
        props: { anchorYear: 2026, active: false, ...props }
    })

/** 网格根元素（mount 返回 element 为 any，收敛为 HTMLElement 以获得类型化查询） */
const gridEl = (w: VueWrapper): HTMLElement => w.element as unknown as HTMLElement

const yearBtn = (w: VueWrapper, label: '上一年' | '下一年'): HTMLButtonElement =>
    gridEl(w).querySelector<HTMLButtonElement>(`.mjp__year-btn[aria-label="${label}"]`)!

const monthButtons = (w: VueWrapper): HTMLButtonElement[] => [
    ...gridEl(w).querySelectorAll<HTMLButtonElement>('.mjp__month')
]

describe('CalendarMonthGrid - 年-月跳转网格', () => {
    it('渲染年文本 + 12 月格', () => {
        const w = mountGrid()
        expect(gridEl(w).textContent).toContain('2026 年')
        expect(monthButtons(w)).toHaveLength(12)
        w.unmount()
    })

    it('月格 data-executeid = monthFirstDateKey(可视年, 月)（YYYY-MM-01）', () => {
        const w = mountGrid({ anchorYear: 2026 })
        const ids = monthButtons(w).map((b) => b.dataset.executeid)
        expect(ids).toEqual(
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => monthFirstDateKey(2026, m))
        )
        expect(ids[8]).toBe('2026-09-01')
        w.unmount()
    })

    it('今天年月格高亮（当前年/月）', () => {
        const now = dayjs()
        const w = mountGrid({ anchorYear: now.year() })
        const current = monthButtons(w).find(
            (b) => b.textContent?.trim() === `${now.month() + 1} 月`
        )!
        expect(current.classList.contains('mjp__month--current')).toBe(true)
        const other = monthButtons(w).find(
            (b) => b.textContent?.trim() === `${now.month() === 0 ? 2 : 1} 月`
        )!
        expect(other.classList.contains('mjp__month--current')).toBe(false)
        w.unmount()
    })

    it('年区 ±1 步进：年文本与全部月格 execute-id 同步平移', async () => {
        const w = mountGrid({ anchorYear: 2026 })
        yearBtn(w, '下一年').click()
        await nextTick()
        expect(gridEl(w).textContent).toContain('2027 年')
        expect(monthButtons(w)[4]!.dataset.executeid).toBe('2027-05-01')

        yearBtn(w, '上一年').click()
        yearBtn(w, '上一年').click()
        await nextTick()
        expect(gridEl(w).textContent).toContain('2025 年')
        expect(monthButtons(w)[0]!.dataset.executeid).toBe('2025-01-01')
        w.unmount()
    })

    it('active 翻转为 true 时可视年复位到锚点年（弹层打开语义）', async () => {
        const w = mountGrid({ anchorYear: 2026, active: false })
        yearBtn(w, '下一年').click()
        await nextTick()
        expect(gridEl(w).textContent).toContain('2027 年')

        await w.setProps({ active: true })
        expect(gridEl(w).textContent).toContain('2026 年')

        // active 为 false 时不复位
        yearBtn(w, '下一年').click()
        await nextTick()
        await w.setProps({ active: false })
        expect(gridEl(w).textContent).toContain('2027 年')
        w.unmount()
    })
})