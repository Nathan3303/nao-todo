// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { TaskViewObject } from '@nao-todo/domain-task'
import TaskBar from '../task-bar.vue'
import { nueUI } from '@/nue-ui-register'

/**
 * T445 ③ 任务条「连续标记」组件级断言
 * @description 规格 = **短横线 `-`**；在**被可视区间边界截断的那一侧**显示：
 *              左端（承接上一段）/ 右端（续接下一段）。渲染由 `contStart`/`contEnd`
 *              驱动（各视图已按自身边界口径计算，见 PR 说明）。
 *              jsdom 不应用 SFC CSS ⇒ 形状（短横线而非圆点）用源级样式断言。
 */

const task = {
    id: 't1',
    name: '跨周任务',
    state: 'todo',
    priority: 'low',
    startAt: '2026-10-05T09:00:00',
    endAt: '2026-10-13T18:00:00',
    createdAt: '2026-10-01T00:00:00',
    tags: []
} as unknown as TaskViewObject

const mountBar = (contStart = false, contEnd = false): VueWrapper =>
    mount(TaskBar, {
        props: {
            task,
            pos: { left: '0%', width: '14.28%', top: '0px' },
            contStart,
            contEnd
        },
        global: { plugins: [nueUI] }
    })

let wrapper: VueWrapper | null = null
afterEach(() => {
    wrapper?.unmount()
    wrapper = null
})

// —— 源级样式断言（jsdom 不应用 SFC CSS；与 daily-view.test.ts 同手法） ——
const RAW = import.meta.glob('../task-bar.vue', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>
const styleText = (): string => Object.values(RAW).join('\n')
const cssRule = (css: string, selector: string): string => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = new RegExp(`${escaped}\\s*\\{`).exec(css)
    if (!match) return ''
    const start = match.index + match[0].length
    const end = css.indexOf('}', start)
    return end < 0 ? css.slice(start) : css.slice(start, end)
}

describe('T445 ③ 任务条连续标记（短横线）', () => {
    it('contStart ⇒ 左端标记（承接上一段）', () => {
        wrapper = mountBar(true, false)
        expect(wrapper.find('[data-testid="cal-cont-start"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="cal-cont-end"]').exists()).toBe(false)
        expect(wrapper.find('.cal-item').classes()).toContain('has-cont-start')
        expect(wrapper.find('.cal-item').classes()).not.toContain('has-cont-end')
    })

    it('contEnd ⇒ 右端标记（续接下一段）', () => {
        wrapper = mountBar(false, true)
        expect(wrapper.find('[data-testid="cal-cont-end"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="cal-cont-start"]').exists()).toBe(false)
        expect(wrapper.find('.cal-item').classes()).toContain('has-cont-end')
    })

    it('跨整段（两端皆截断）⇒ 左+右两枚标记', () => {
        wrapper = mountBar(true, true)
        expect(wrapper.find('[data-testid="cal-cont-start"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="cal-cont-end"]').exists()).toBe(true)
    })

    it('未截断（contStart/contEnd 皆 false）⇒ 不渲染任何标记', () => {
        wrapper = mountBar(false, false)
        expect(wrapper.find('[data-testid="cal-cont-start"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="cal-cont-end"]').exists()).toBe(false)
        expect(wrapper.find('.cal-item').classes()).not.toContain('has-cont-start')
        expect(wrapper.find('.cal-item').classes()).not.toContain('has-cont-end')
    })

    it('标记为装饰性元素（aria-hidden），不污染任务名可读性', () => {
        wrapper = mountBar(true, true)
        expect(wrapper.find('[data-testid="cal-cont-start"]').attributes('aria-hidden')).toBe(
            'true'
        )
        expect(wrapper.find('[data-testid="cal-cont-end"]').attributes('aria-hidden')).toBe('true')
        expect(wrapper.find('.cal-item-text').text()).toBe('跨周任务')
    })

    it('源级形状：短横线（宽 7px × 高 2px，非圆点）· 承接/续接分列两端', () => {
        const css = styleText()
        const base = cssRule(css, '.cal-cont')
        expect(base).not.toBe('')
        expect(base).toContain('width: 7px')
        expect(base).toContain('height: 2px')
        expect(base).toContain('color-mix(in srgb, var(--cal-fg) 62%')
        expect(base).not.toContain('border-radius: 50%')
        expect(cssRule(css, '.cal-cont--start')).toContain('left: 4px')
        expect(cssRule(css, '.cal-cont--end')).toContain('right: 4px')
    })

    it('源级：带标记的一侧预留文本间距（防名称压标记）', () => {
        const css = styleText()
        expect(cssRule(css, '.cal-item.has-cont-start')).toContain('padding-left: 15px')
        expect(cssRule(css, '.cal-item.has-cont-end')).toContain('padding-right: 15px')
    })
})