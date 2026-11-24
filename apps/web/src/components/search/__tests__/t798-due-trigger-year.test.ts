// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { nueUI } from '../../../nue-ui-register'
import SearchDueTrigger from '../search-due-trigger.vue'

/** SFC / CSS 源码（`?raw`；⛔ 不用 `node:fs` —— 会把 `@types/node` 全局漏进 `apps/web` 程序） */
const rawModules = import.meta.glob(
    [
        '/apps/web/src/components/search/search-due-trigger.vue',
        '/apps/web/src/components/search/filter-trigger.css'
    ],
    { query: '?raw', import: 'default', eager: true }
) as Record<string, string>
const dueTriggerSource = rawModules['/apps/web/src/components/search/search-due-trigger.vue'] ?? ''
const filterTriggerCss = rawModules['/apps/web/src/components/search/filter-trigger.css'] ?? ''

/**
 * 截止日触发器「年份省略」规则（`#398` 三轮 · 用户实报）
 *
 * @description 事故：`2025-11-01` 至 `2026-09-08` 只显示「11/1 至 9/8」，读者会以为
 *              **起点晚于终点**（跨年被省略成同一年的读法）。规则：
 *              ① 两端年份不同 ⇒ 两端都带年份；
 *              ② 任一端非当前年 ⇒ 该端带年份；
 *              ③ 两端都在当前年 ⇒ 保持紧凑 `M/D`。
 */
beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 24, 12, 0, 0))
})
afterEach(() => vi.useRealTimers())

const text = (props: { from: string; to: string }) =>
    mount(
        SearchDueTrigger as never,
        {
            props: { ...props, includeNoDue: false },
            global: { plugins: [nueUI] }
        } as never
    )
        .find('[data-role="due-trigger"]')
        .text()

describe('T798 · 跨年区间必须带年份', () => {
    it('两端跨年 ⇒ 两端都带年份（用户实报场景）', () => {
        const out = text({ from: '2025-11-01', to: '2026-09-08' })
        expect(out).toContain('2025')
        expect(out).toContain('2026')
    })

    it('两端同年且为今年 ⇒ 省略年份（保持紧凑）', () => {
        const out = text({ from: '2026-03-01', to: '2026-09-08' })
        expect(out).not.toContain('2026')
        expect(out).toContain('3月1日')
        expect(out).toContain('9月8日')
    })

    it('两端同年但不是今年 ⇒ 带年份（避免被读成今年）', () => {
        const out = text({ from: '2025-03-01', to: '2025-09-08' })
        expect(out).toContain('2025')
    })

    it('单边且非今年 ⇒ 带年份', () => {
        const out = text({ from: '2025-11-01', to: '' })
        expect(out).toContain('2025')
    })

    it('单边且为今年 ⇒ 不带年份', () => {
        const out = text({ from: '', to: '2026-09-08' })
        expect(out).not.toContain('2026')
        expect(out).toContain('9月8日')
    })
})
/**
 * 面板排版契约（`#398` 四轮 · 用户实报「下拉列表排版」）
 *
 * @description 三处此前不成立：① 起/止两个选择器宽度随内容变 ⇒ 右缘不对齐；
 *              ② 「清除日期」与开关行同组、无分隔 ⇒ 贴在一起；③ 完整值无处可看。
 */
describe('T798 · 触发器截断与面板排版', () => {
    const mountTrigger = (props: { from: string; to: string; includeNoDue?: boolean }) =>
        mount(
            SearchDueTrigger as never,
            {
                props: { includeNoDue: false, ...props },
                global: { plugins: [nueUI] }
            } as never
        )

    it('触发器带 title = 完整区间文案（截断时悬停可见）', () => {
        const wrapper = mountTrigger({ from: '2025-11-01', to: '2026-09-08' })
        const title = wrapper
            .find('[data-role="due-trigger"] .filter-trigger-label')
            .attributes('title')
        expect(title).toBeTruthy()
        expect(title).toContain('2025')
        expect(title).toContain('2026')
        // 完整文案里不应出现省略号（title 是兜底，不是把截断结果再抄一遍）
        expect(title).not.toContain('…')
    })

    it('两个日期选择器共用同一类（等宽拉伸，右缘对齐）', () => {
        const wrapper = mountTrigger({ from: '2025-11-01', to: '' })
        const pickers = wrapper.findAll('.due-panel__picker')
        expect(pickers.length).toBe(2)
    })

    it('清除动作独立成组（分组容器存在时才渲染），不与开关同行', () => {
        const withDates = mountTrigger({ from: '2026-03-01', to: '2026-03-05' })
        expect(withDates.find('.due-panel__actions').exists()).toBe(true)
        const clear = withDates.find('.due-panel__actions .due-panel__clear')
        expect(clear.exists()).toBe(true)
        const empty = mountTrigger({ from: '', to: '' })
        expect(empty.find('.due-panel__actions').exists()).toBe(false)
    })

    /**
     * 源码契约：面板排版
     *
     * @description `#403`（T755）把面板由**横排**（标签定宽 3.25rem + 选择器 `flex: 1 1 0`）
     *              改为**竖排表单**（标签在上、控件全宽、`nue-divider` 分段、动作区由分隔线而非
     *              `border-top` 与上方分开）⇒ 原三条断言（定宽标签 / flex 拉伸 / border-top）
     *              所描述的布局已被需求取消，改为断言新骨架。**判据变更仅此几条 CSS 契约**，
     *              `data-role` 断言与本文件其余用例（标题 / 年份 / 清除组）均未改。
     *              返工轮（用户实报「样式还是不对」）：面板改为逐值复刻任务详情面板的日期选择器
     *              ⇒ 标签选择器按参考件换成 `.due-panel__row > .nue-text`（值 400，非上版的 600），
     *              此为本用例**唯一**改动的一行判据。
     */
    it('源码契约：竖排骨架（标签在上/控件全宽/分隔线分段）、日期等宽数字', () => {
        expect(dueTriggerSource).toMatch(/\.due-panel__row > \.nue-text\s*\{[^}]*color:/m)
        expect(dueTriggerSource).toMatch(/\.due-panel__picker\s*\{[^}]*width:\s*100%/m)
        expect(dueTriggerSource).not.toMatch(/min-width:\s*3\.25rem/)
        expect(dueTriggerSource).not.toMatch(/\.due-panel__actions\s*\{[^}]*border-top:/m)
        expect(dueTriggerSource).toMatch(/<nue-divider\s*\/>/)
        expect(dueTriggerSource).toMatch(/font-variant-numeric:\s*tabular-nums/)
        // 触发器上限放宽到 18rem（220px 会截掉年份尾部）
        expect(filterTriggerCss).toMatch(/max-width:\s*18rem/)
        expect(filterTriggerCss).not.toMatch(/max-width:\s*220px/)
    })
})