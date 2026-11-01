// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { SegmentedSwitch } from '../index'

/**
 * T615 `size="inline"` 第三档（DESIGN §4.5 · PRD R-H）
 * @description 看板分组切换嵌在「视图」下拉菜单内，需与菜单条目（`nue-dropdown-item--small`
 *              = 32px / 12px）齐平 ⇒ 分段件新增 `inline` 档。
 *              本用例只断言**结构契约与 token 契约**（不写死 px，避免主题微调即碎）；真实几何
 *              （computed min-height / font-size）由交付回执给 headless Chromium 实测数字。
 */

const TWO = [
    { value: 'state', label: '状态' },
    { value: 'priority', label: '优先级' }
]

const mountSeg = (size?: 'sm' | 'md' | 'inline') =>
    mount(SegmentedSwitch, {
        props: { items: TWO, modelValue: 'state', ariaLabel: '分组', ...(size ? { size } : {}) }
    })

describe('T615 SegmentedSwitch size=inline', () => {
    it('size=inline ⇒ 根挂 is-inline；sm / md 三档互斥（各只挂自己那档）', () => {
        const inline = mountSeg('inline')
        expect(inline.get('.segmented-toggle').classes()).toContain('is-inline')
        expect(inline.get('.segmented-toggle').classes()).not.toContain('is-md')

        const sm = mountSeg()
        expect(sm.get('.segmented-toggle').classes()).not.toContain('is-inline')

        const md = mountSeg('md')
        expect(md.get('.segmented-toggle').classes()).toContain('is-md')
        expect(md.get('.segmented-toggle').classes()).not.toContain('is-inline')
    })

    it('inline 档只走尺寸轴：段数 / 滑块 / aria 契约不受影响，无内联尺寸注入', () => {
        const w = mountSeg('inline')
        const btns = w.findAll('.segmented-btn')
        expect(btns).toHaveLength(2)
        expect(btns.every((b) => b.attributes('style') === undefined)).toBe(true)
        expect(w.get('[data-testid="segmented-thumb"]').attributes('aria-hidden')).toBe('true')
        // 点击仍只上抛段值（切换语义归调用方）
        expect(w.get('.segmented-toggle').attributes('role')).toBe('group')
    })

    it('inline 档样式写在组件内、且只用尺寸 token（段高 sm / 字号 xs）', () => {
        const css = Object.values(
            import.meta.glob('/packages/shared/components/segmented-switch/segmented-switch.vue', {
                query: '?raw',
                import: 'default',
                eager: true
            }) as Record<string, string>
        ).join('\n')
        const flat = css.replace(/\s+/g, ' ')
        // 差异收敛在组件内（调用方不得覆盖）：一条规则只改段高 + 字号
        expect(flat).toContain('.segmented-toggle.is-inline > .segmented-btn')
        expect(flat).toMatch(
            /\.segmented-toggle\.is-inline > \.segmented-btn \{[^}]*min-height: var\(--nue-box-size-sm\);[^}]*font-size: var\(--nue-text-xs\);/
        )
        // 既有 sm / md 档不被改动（md 仍为 box-size-md，且不引入字号差异）
        expect(flat).toMatch(
            /\.segmented-toggle\.is-md > \.segmented-btn \{\s*min-height: var\(--nue-box-size-md\);?\s*\}/
        )
    })
})