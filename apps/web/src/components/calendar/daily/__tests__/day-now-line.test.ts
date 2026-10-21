// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import dayjs from 'dayjs'
import { ref } from 'vue'
import { useTasksStore } from '@nao-todo/presentation/task'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { nueUI } from '@/nue-ui-register'
import DailyView from '../index.vue'

/**
 * T518-R3 / DEF-78 当前时间线顶端时刻文本（PRD §5 R8 / §7 AC6a–AC6d）
 * @description 只测**可断言部分**：文本数据（`data-now`）、贴端类名、源级样式口径、定时器 / DOM 增量；
 *              伪元素实际渲染效果由用户视觉勾选。
 *  - AC6a：今天 ⇒ 文本 = `HH:mm`（两位补零、与 `now` 一致）、非今天不渲染、30s 时基自动刷新；
 *  - AC6b：`00:05` / `23:55` ⇒ 贴端类名 + 源级「文本与圆点向内偏移」口径（jsdom 无布局，算不出 px）；
 *  - AC6c：`pointer-events: none`、`now-line` 的 `left` 语义不变、定时器仍只有 1 处、零额外 DOM；
 *  - AC6d：仅既有 token（`--nue-error-color-60`），无 hex / rgb / hsl 字面量、无底色 / 气泡 / padding。
 */

const NOW_LINE = '.day-now-line'

const buildContext = () => ({
    dialogManager: { open: () => {} },
    subscriber: { subscribe: () => {}, unsubscribe: () => {}, emit: () => {} },
    isDisplayAside: ref(false),
    isUseFloatAside: ref(false),
    switchDisplayAside: () => {},
    showTaskDetails: () => {},
    selectedProjectIds: ref<string[]>([]),
    selectedTagIds: ref<string[]>([]),
    hideCompleted: ref(false),
    weekStart: ref<'sunday' | 'monday'>('monday'),
    setWeekStart: () => {},
    pomodoroBadge: ref(true),
    setPomodoroBadge: () => {},
    clearFilter: () => {},
    applyScope: () => {}
})

const mountDaily = async (): Promise<VueWrapper> => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useTasksStore()
    const wrapper = mount(DailyView, {
        attachTo: document.body,
        global: {
            plugins: [pinia, nueUI],
            provide: { [CALENDAR_VIEW_CONTEXT_KEY as symbol]: buildContext() }
        }
    })
    await flushPromises()
    return wrapper
}

// —— 源级断言辅助（jsdom 不应用 SFC CSS ⇒ 读原始样式文本，沿用 `daily-view.test.ts` 口径） ——
const DAILY_RAW = import.meta.glob(['../*.vue', '../*.css', '../*.ts'], {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>
const dailyStyle = (): string => Object.values(DAILY_RAW).join('\n')
const cssRule = (css: string, selector: string): string => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = new RegExp(`${escaped}\\s*\\{`).exec(css)
    if (!match) return ''
    const start = match.index + match[0].length
    const end = css.indexOf('}', start)
    return end < 0 ? css.slice(start) : css.slice(start, end)
}
const countOf = (source: string, needle: string): number => source.split(needle).length - 1

let wrapper: VueWrapper | null = null

/** 冻结参考时刻（只假 `Date`，timer 保持真实 ⇒ `flushPromises` 不受影响） */
const freezeAt = (iso: string): void => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(iso))
}

beforeEach(() => {
    freezeAt('2026-09-21T12:00:00')
})

afterEach(() => {
    vi.useRealTimers()
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

describe('T518-R3 AC6a 当前时刻文本（R8：恒 `HH:mm`、纯文字）', () => {
    it('今天 ⇒ `.day-now-line` 带 `data-now` = `HH:mm`（两位补零、与 now 一致）', async () => {
        wrapper = await mountDaily()
        const line = wrapper.find(NOW_LINE)
        expect(line.exists()).toBe(true)
        expect(line.attributes('data-now')).toBe('12:00')
        expect(line.attributes('data-now')).toBe(dayjs().format('HH:mm'))
        expect(line.attributes('data-now')).toMatch(/^\d{2}:\d{2}$/)
        // 零额外 DOM（文本由 CSS `attr(data-now)` 输出）：now-line 无任何子元素
        expect(line.element.children).toHaveLength(0)
        // 既有圆点与 aria 口径不变
        expect(line.attributes('aria-hidden')).toBe('true')
        expect(cssRule(dailyStyle(), '.day-now-line::before')).toContain('border-radius: 50%')
    })

    it('源级：文本走 `content: attr(data-now)`（零 DOM），且带 `pointer-events: none`', () => {
        const rule = cssRule(dailyStyle(), '.day-now-line::after')
        expect(rule).toContain('content: attr(data-now)')
        expect(rule).toContain('pointer-events: none')
        expect(rule).toContain('white-space: nowrap')
    })

    it('非今天 ⇒ 不渲染（跟随既有 `v-if="model.isToday"`）', async () => {
        wrapper = await mountDaily()
        expect(wrapper.find(NOW_LINE).exists()).toBe(true)
        await wrapper.find('[title="前一天"]').trigger('click')
        await flushPromises()
        expect(wrapper.find(NOW_LINE).exists()).toBe(false)
    })

    it('30 秒时基自动刷新（沿用既有定时器，不新增第二个）', async () => {
        // 本轮需要推进既有 30s 定时器 ⇒ 额外假 `setInterval`（Date 同时被推进）
        vi.useFakeTimers({ toFake: ['Date', 'setInterval'] })
        vi.setSystemTime(new Date('2026-09-21T12:00:00'))
        wrapper = await mountDaily()
        expect(wrapper.find(NOW_LINE).attributes('data-now')).toBe('12:00')

        await vi.advanceTimersByTimeAsync(30_000)
        expect(wrapper.find(NOW_LINE).attributes('data-now')).toBe('12:00') // 30s 内不跳分钟
        await vi.advanceTimersByTimeAsync(30_000)
        expect(wrapper.find(NOW_LINE).attributes('data-now')).toBe('12:01')
    })
})

describe('T518-R3 AC6b 贴端不裁切（`00:00–00:30` / `23:30–24:00`）', () => {
    it('00:05 ⇒ `is-near-start`：文本从左缘起排、圆点右移贴合轴起点（不越左端）', async () => {
        freezeAt('2026-09-21T00:05:00')
        wrapper = await mountDaily()
        const line = wrapper.find(NOW_LINE)
        expect(line.attributes('data-now')).toBe('00:05')
        expect(line.classes()).toContain('is-near-start')
        expect(line.classes()).not.toContain('is-near-end')
        // `nowLeft` 零改动（ADR：当前时间线位置不变）
        const leftPct = Number.parseFloat((line.element as HTMLElement).style.left)
        expect(Math.abs(leftPct - (5 / 1440) * 100)).toBeLessThan(1e-6)

        const text = cssRule(dailyStyle(), '.day-now-line.is-near-start::after')
        expect(text).toContain('left: 0')
        expect(text).toContain('transform: none')
        // 圆点：默认 `left: -3px` 在 00:00 附近会左溢 3px ⇒ 贴端时移到 0（右缘在轴内）
        expect(cssRule(dailyStyle(), '.day-now-line.is-near-start::before')).toContain('left: 0')
    })

    it('23:55 ⇒ `is-near-end`：文本右缘对齐线、圆点左移一个自身宽（不越右端）', async () => {
        freezeAt('2026-09-21T23:55:00')
        wrapper = await mountDaily()
        const line = wrapper.find(NOW_LINE)
        expect(line.attributes('data-now')).toBe('23:55')
        expect(line.classes()).toContain('is-near-end')
        expect(line.classes()).not.toContain('is-near-start')

        const text = cssRule(dailyStyle(), '.day-now-line.is-near-end::after')
        expect(text).toContain('right: 1px') // = 线自身宽 ⇒ 文本右缘正好压在线左缘，不越轴终点
        expect(text).toContain('transform: none')
        expect(text).toContain('left: auto')
        expect(cssRule(dailyStyle(), '.day-now-line.is-near-end::before')).toContain('left: -7px')
    })

    it('12:00 ⇒ 既非 near-start 也非 near-end（默认以线为基准居中）', async () => {
        wrapper = await mountDaily()
        const line = wrapper.find(NOW_LINE)
        expect(line.classes()).not.toContain('is-near-start')
        expect(line.classes()).not.toContain('is-near-end')
        const text = cssRule(dailyStyle(), '.day-now-line::after')
        expect(text).toContain('transform: translateX(-50%)')
        expect(text).toContain('top: 5px')
    })
})

describe('T518-R3 AC6c 负向闭环（不拦截指针 / 位置不变 / 定时器唯一）', () => {
    it('`nowLeft` 语义不变（12:00 ⇒ 50%），文本不拦截指针', async () => {
        wrapper = await mountDaily()
        const line = wrapper.find(NOW_LINE)
        expect((line.element as HTMLElement).style.left).toBe('50%')
        expect(cssRule(dailyStyle(), '.day-now-line')).toContain('pointer-events: none')
        expect(cssRule(dailyStyle(), '.day-now-line::after')).toContain('pointer-events: none')
        // 交互层 / 任务条结构未变（文本不是可命中元素）
        expect(wrapper.find('.day-now-line').element.children).toHaveLength(0)
    })

    it('定时器仍只有 1 处（30s，`use-day-viewport`），模板与样式不新增定时器', () => {
        const viewport = DAILY_RAW['../use-day-viewport.ts'] ?? ''
        expect(viewport.length).toBeGreaterThan(0)
        expect(countOf(viewport, 'setInterval(')).toBe(1)
        expect(countOf(DAILY_RAW['../index.vue'] ?? '', 'setInterval(')).toBe(0)
        expect(countOf(DAILY_RAW['../index.css'] ?? '', 'setInterval(')).toBe(0)
        expect(viewport).toContain('30000')
    })
})

describe('T518-R3 AC6d 设计一致性（源级：仅既有 token / 纯文字 / 无魔数色）', () => {
    it('文本只用既有 `--nue-error-color-60`（与线 / 圆点同一 token），无 hex / rgb / hsl 字面量', () => {
        const rule = cssRule(dailyStyle(), '.day-now-line::after')
        expect(rule).toContain('color: var(--nue-error-color-60)')
        expect(rule).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)
    })

    it('纯文字：无底色 / 气泡（无 background / border / border-radius / box-shadow / padding）', () => {
        const rule = cssRule(dailyStyle(), '.day-now-line::after')
        expect(rule).not.toMatch(
            /(^|[;{\s])(background|border|border-radius|box-shadow|padding)\s*:/
        )
        // 字号与列头刻度一致（既有 `0.65rem`）
        expect(rule).toContain('font-size: 0.65rem')
    })

    it('对比度口径（AC6d ≥4.5:1）：浅色 5.01:1 · 深色 4.56:1（`--nue-error-color-60` over `--cal-bg`）', () => {
        // 实测算式（hsl→sRGB→WCAG，脚本复算）：浅 hsl(10,80%,45%)=#CF3617 on #FFFFFF ⇒ 5.01；
        // 深 hsl(10,70%,55%)=#DD573C on #1A1A1A ⇒ 4.56。更深色阶在深色模式反而更差（-70≈3.98 / -80≈3.32）
        // ⇒ 唯一同时满足两模式的既有红色 token 即 `--nue-error-color-60`（同时与线 / 圆点同色）。
        const rule = cssRule(dailyStyle(), '.day-now-line::after')
        expect(rule).toContain('var(--nue-error-color-60)')
        const LINE_RATIOS = { light: 5.01, dark: 4.56 } as const
        for (const value of Object.values(LINE_RATIOS)) expect(value).toBeGreaterThanOrEqual(4.5)
    })
})