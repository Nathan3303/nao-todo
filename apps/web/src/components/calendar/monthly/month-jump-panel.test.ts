// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import dayjs from 'dayjs'
import MonthJumpPanel from './month-jump-panel.vue'

/**
 * C2-F9 年月跳转面板组件断言
 * @description 开关渲染、年步进与月格即时跳转 emit、当前年/月高亮、Esc/外点关闭、触发器豁免。
 */

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const mountPanel = (
    props: {
        open?: boolean
        anchorYear?: number
        anchorMonth?: number
        x?: number
        y?: number
    } = {}
) => {
    wrapper = mount(MonthJumpPanel, {
        attachTo: document.body,
        props: {
            open: true,
            anchorYear: 2026,
            anchorMonth: 9,
            x: 100,
            y: 120,
            ...props
        }
    })
    return wrapper
}

const panelEl = (): HTMLElement | null => document.body.querySelector('.mjp')
const monthButton = (label: string): HTMLButtonElement | null => {
    const btn = [...(panelEl()?.querySelectorAll<HTMLButtonElement>('.mjp__month') ?? [])].find(
        (b) => b.textContent?.trim() === label
    )
    return btn ?? null
}

describe('MonthJumpPanel - C2-F9 年月跳转', () => {
    it('打开渲染：年文本 + 12 月格', () => {
        mountPanel()
        expect(panelEl()).toBeTruthy()
        expect(panelEl()!.textContent).toContain('2026 年')
        expect(panelEl()!.querySelectorAll('.mjp__month').length).toBe(12)
    })

    it('当前年/月格高亮（今天年月）', () => {
        mountPanel({ anchorYear: dayjs().year() })
        const currentLabel = `${dayjs().month() + 1} 月`
        const current = monthButton(currentLabel)!
        expect(current.classList.contains('mjp__month--current')).toBe(true)
        // 其它月份不高亮
        const other = monthButton(dayjs().month() === 0 ? '2 月' : '1 月')!
        expect(other.classList.contains('mjp__month--current')).toBe(false)
    })

    it('年 ↑ 步进后月格点击 emit (年, 月)（即时跳转无二次确认）', async () => {
        const w = mountPanel()
        const nextYear = panelEl()!.querySelector<HTMLButtonElement>(
            '.mjp__year-btn[aria-label="下一年"]'
        )!
        nextYear.click()
        await nextTick()
        expect(panelEl()!.textContent).toContain('2027 年')
        monthButton('5 月')!.click()
        expect(w.emitted('select')?.[0]).toEqual([2027, 5])
    })

    it('直接点月格 = emit 锚点年 + 月（2026-9 → select 2026,9）', () => {
        const w = mountPanel()
        monthButton('9 月')!.click()
        expect(w.emitted('select')?.[0]).toEqual([2026, 9])
    })

    it('Esc / 外点 → close（无副作用事件流）', async () => {
        const w = mountPanel()
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        expect(w.emitted('close')).toHaveLength(1)
        // 外点（body）关闭
        w.emitted().close = []
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        expect(w.emitted('close')).toHaveLength(1)
    })

    it('面板自身与触发器（data-mjp-trigger）pointerdown 不关闭', async () => {
        const w = mountPanel()
        const inside = panelEl()!.querySelector('.mjp__year-btn')!
        inside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        expect(w.emitted('close')).toBeUndefined()
        const trigger = document.createElement('button')
        trigger.dataset.mjpTrigger = ''
        document.body.appendChild(trigger)
        trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        expect(w.emitted('close')).toBeUndefined()
    })

    it('open=false 不渲染', () => {
        mountPanel({ open: false })
        expect(panelEl()).toBeNull()
    })
})