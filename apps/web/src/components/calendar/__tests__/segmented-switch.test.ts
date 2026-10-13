// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { nueUI } from '@/nue-ui-register'
import SegmentedSwitch from '../segmented-switch.vue'

/**
 * T512 通用「分段切换」组件契约（纯展示件：modelValue + items 注入，点击上抛 update:modelValue）
 * @description N 段等分 + 滑块指示器整段平移；选中/hover/动效降级单一来源；
 *              两处调用（日/月/周 3 段铺满 / 周起始 2 段自适应）共用本件，仅段数与宽度策略不同。
 */

const THREE = [
    { label: '月', value: 'month', testId: 'v-month' },
    { label: '周', value: 'week', testId: 'v-week' },
    { label: '日', value: 'day', testId: 'v-day' }
]
const TWO = [
    { label: '周日', value: 'sunday' },
    { label: '周一', value: 'monday' }
]

type SegItem = { label: string; value: string; testId?: string }

const mountSeg = (props: {
    items: readonly SegItem[]
    modelValue: string
    fill?: boolean
    ariaLabel?: string
}) =>
    mount(SegmentedSwitch, {
        props: { ariaLabel: '分组', ...props },
        global: { plugins: [nueUI] }
    })

/** jsdom 会把 `calc(100% / N)` 归一化为百分比（如 calc(33.3333%) / calc(50%)）⇒ 解析百分比断言等分语义 */
const thumbWidthRatio = (el: HTMLElement): number => {
    const match = /([\d.]+)%/.exec(el.style.width)
    return match ? Number.parseFloat(match[1]!) : Number.NaN
}

describe('T512 CalendarSegmentedSwitch', () => {
    it('N=3：三格等分 + 滑块 0/100%/200% 平移（宽度 = 容器 1/3）', () => {
        const month = mountSeg({ items: THREE, modelValue: 'month' })
        const week = mountSeg({ items: THREE, modelValue: 'week' })
        const day = mountSeg({ items: THREE, modelValue: 'day' })
        const thumbOf = (w: ReturnType<typeof mountSeg>): HTMLElement =>
            w.find('[data-testid="segmented-thumb"]').element as HTMLElement
        expect(month.findAll('.segmented-btn')).toHaveLength(3)
        // 指示器宽 = 容器 1/3（jsdom 归一化 calc ⇒ 按百分比语义断言）
        expect(thumbWidthRatio(thumbOf(month))).toBeCloseTo(100 / 3, 1)
        expect(thumbOf(month).style.transform).toBe('translateX(0%)')
        expect(thumbOf(week).style.transform).toBe('translateX(100%)')
        expect(thumbOf(day).style.transform).toBe('translateX(200%)')
    })

    it('N=2：两格等分 + 滑块 0/100% 平移（宽度 = 容器 1/2）', () => {
        const sunday = mountSeg({ items: TWO, modelValue: 'sunday' })
        const monday = mountSeg({ items: TWO, modelValue: 'monday' })
        const thumbOf = (w: ReturnType<typeof mountSeg>): HTMLElement =>
            w.find('[data-testid="segmented-thumb"]').element as HTMLElement
        expect(sunday.findAll('.segmented-btn')).toHaveLength(2)
        // 指示器宽 = 容器 1/2
        expect(thumbWidthRatio(thumbOf(sunday))).toBeCloseTo(50, 1)
        expect(thumbOf(sunday).style.transform).toBe('translateX(0%)')
        expect(thumbOf(monday).style.transform).toBe('translateX(100%)')
    })

    it('aria 契约：role=group + aria-label；每段 aria-pressed 随选中态；指示器装饰性', () => {
        const w = mountSeg({ items: THREE, modelValue: 'week', ariaLabel: '视图切换' })
        const groupEl = w.get('.segmented-toggle').element as HTMLElement
        expect(groupEl.getAttribute('role')).toBe('group')
        expect(groupEl.getAttribute('aria-label')).toBe('视图切换')
        const btns = w.findAll('.segmented-btn')
        expect(btns[0]!.attributes('aria-pressed')).toBe('false')
        expect(btns[1]!.attributes('aria-pressed')).toBe('true')
        expect(btns[2]!.attributes('aria-pressed')).toBe('false')
        expect(w.find('[data-testid="segmented-thumb"]').attributes('aria-hidden')).toBe('true')
    })

    it('点击段 ⇒ 上抛 update:modelValue（段值与文案一致）', async () => {
        const w = mountSeg({ items: TWO, modelValue: 'sunday' })
        await w.findAll('.segmented-btn')[1]!.trigger('click')
        expect(w.emitted('update:modelValue')).toEqual([['monday']])
        await w.findAll('.segmented-btn')[0]!.trigger('click')
        expect(w.emitted('update:modelValue')).toEqual([['monday'], ['sunday']])
    })

    it('宽度策略：默认铺满（is-fill），fill=false 自适应（无 is-fill）', () => {
        const fill = mountSeg({ items: TWO, modelValue: 'sunday' })
        expect(fill.get('.segmented-toggle').classes()).toContain('is-fill')
        const fit = mountSeg({ items: TWO, modelValue: 'sunday', fill: false })
        expect(fit.get('.segmented-toggle').classes()).not.toContain('is-fill')
    })

    it('动效降级：既有 nue-* token、180ms 平移 + prefers-reduced-motion 取消过渡；零 --cal-* 引用', () => {
        const css = Object.values(
            import.meta.glob('../segmented-switch.vue', {
                query: '?raw',
                import: 'default',
                eager: true
            }) as Record<string, string>
        ).join('\n')
        const flat = css.replace(/\s+/g, ' ')
        expect(flat).toContain('transition: transform 180ms ease')
        expect(flat).toContain('prefers-reduced-motion: reduce')
        expect(flat).toContain('.segmented-thumb')
        // T448 根因：侧栏在日历令牌组之外 ⇒ 分段控件不得引 `--cal-*`
        expect(flat).not.toContain('var(--cal-')
    })
})