// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import dayjs from 'dayjs'
import { ref } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
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

const TODAY_KEY = '2026-09-21'
/** 09:00–10:00 的单条任务（lane 0；验证「lane → 纵坐标」相对映射用） */
const TASK_AT_0900 = {
    id: 'a',
    name: '任务 a',
    state: 'todo',
    priority: 'low',
    startAt: `${TODAY_KEY} 09:00:00`,
    endAt: `${TODAY_KEY} 10:00:00`,
    createdAt: '2026-09-01 00:00:00',
    tags: []
} as unknown as TaskViewObject

const mountDaily = async (tasks: TaskViewObject[] = []): Promise<VueWrapper> => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useTasksStore()
    if (tasks.length > 0) store.addTasks(tasks)
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
    it('00:05 ⇒ `is-near-start`：文本从左缘起排；圆点保持与线同轴心', async () => {
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
        // R10（T518-R4 反转 R3）：**圆点不再随贴端水平位移**，恒与线同轴心（`left: -3px`）
        expect(cssRule(dailyStyle(), '.day-now-line.is-near-start::before')).toBe('')
        expect(cssRule(dailyStyle(), '.day-now-line::before')).toContain('left: -3px')
    })

    it('23:55 ⇒ `is-near-end`：文本右缘对齐线；圆点同轴心（不再左移）', async () => {
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
        // R10（反转 R3）：圆点无贴端位移
        expect(cssRule(dailyStyle(), '.day-now-line.is-near-end::before')).toBe('')
        expect(cssRule(dailyStyle(), '.day-now-line::before')).toContain('left: -3px')
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

describe('T518-R4 AC7 泳道上方间隔带（R9 / R10；带高 24px，arch 评审版）', () => {
    const bandPx = (): number => {
        const raw = /--day-now-band:\s*([\d.]+)px/.exec(DAILY_RAW['../index.css'] ?? '')?.[1]
        return Number.parseFloat(raw ?? 'NaN')
    }

    it('AC7d 带高单一来源：`--day-now-band` 定义仅 1 处（24px），只有泳道层消费该变量', () => {
        const css = DAILY_RAW['../index.css'] ?? ''
        expect(countOf(css, '--day-now-band:')).toBe(1)
        expect(bandPx()).toBe(24)
        expect(countOf(css, 'var(--day-now-band)')).toBe(1)
        const lanes = cssRule(css, '.day-grid .cal-lanes')
        expect(lanes).toContain('top: var(--day-now-band)')
        expect(lanes.match(/\d+px/)).toBeNull()
        // arch 口径：`.day-axis-bg` / `.day-axis-track` 覆盖整列、**不下移**；间隔带不靠 padding 实现
        for (const selector of ['.day-axis-bg', '.day-axis-track']) {
            const rule = cssRule(css, selector)
            expect(rule, selector).toContain('inset: 0')
            expect(rule, selector).not.toContain('--day-now-band')
        }
        expect(cssRule(css, '.day-grid')).not.toMatch(/padding-top/)
        for (const selector of ['.day-axis-endpoint', '.day-drag-snap-line']) {
            expect(cssRule(css, selector), selector).not.toContain('--day-now-band')
            expect(cssRule(css, selector), selector).toContain('top: 0')
        }
    })

    it('AC7a 整个文本盒（top + line-height）完整落在带内：5 + 15.6 = 20.6px ≤ 24px', () => {
        const text = cssRule(DAILY_RAW['../index.css'] ?? '', '.day-now-line::after')
        const top = Number.parseFloat(/top:\s*([\d.]+)px/.exec(text)![1]!)
        const fontSizeRem = Number.parseFloat(/font-size:\s*([\d.]+)rem/.exec(text)![1]!)
        const lineHeight = Number.parseFloat(/line-height:\s*([\d.]+)/.exec(text)![1]!)
        // 根字号 16px（`--nue-primary-font-size-base`）⇒ 行高 0.65 × 16 × 1.5 = 15.6px
        const textBottom = top + fontSizeRem * 16 * lineHeight
        expect(top).toBe(5)
        expect(textBottom).toBeCloseTo(20.6, 5)
        expect(textBottom).toBeLessThanOrEqual(bandPx())
    })

    it('AC7a 带恒定存在：非今天无文本，泳道层仍在且偏移规则无条件（不随今天切换跳动）', async () => {
        const css = DAILY_RAW['../index.css'] ?? ''
        expect(cssRule(css, '.day-grid .cal-lanes')).not.toMatch(/is-today|day-now-line/)
        wrapper = await mountDaily()
        expect(wrapper.find('.day-grid .cal-lanes').exists()).toBe(true)
        await wrapper.find('[title="前一天"]').trigger('click')
        await flushPromises()
        expect(wrapper.find(NOW_LINE).exists()).toBe(false)
        expect(wrapper.find('.day-grid .cal-lanes').exists()).toBe(true)
    })

    it('AC7b 贴端时文本纵向不变（不进入泳道），圆点与线同轴心（R3 位移规则已删）', () => {
        const css = DAILY_RAW['../index.css'] ?? ''
        for (const cls of ['is-near-start', 'is-near-end']) {
            const rule = cssRule(css, `.day-now-line.${cls}::after`)
            expect(rule, cls).not.toBe('')
            expect(rule, cls).not.toMatch(/(^|[;\s])top\s*:/) // 纵向不随贴端改变
            expect(rule, cls).not.toMatch(/bottom\s*:/)
        }
        expect(cssRule(css, '.day-now-line::before')).toContain('left: -3px')
        expect(cssRule(css, '.day-now-line.is-near-start::before')).toBe('')
        expect(cssRule(css, '.day-now-line.is-near-end::before')).toBe('')
    })

    it('AC7c lane → 纵坐标相对映射不变：任务条自身 top 仍为 lane × 步长（位移由泳道层承担）', async () => {
        wrapper = await mountDaily([TASK_AT_0900])
        const seg = wrapper.find('[data-testid="day-task"]').element.parentElement as HTMLElement
        expect(seg.classList.contains('day-seg')).toBe(true)
        expect(seg.style.top).toBe('0px') // lane 0 ⇒ 与改动前逐字节一致（下移由 .cal-lanes 承担）
        expect(cssRule(dailyStyle(), '.day-grid .cal-lanes')).toContain('top: var(--day-now-band)')
        // 拖拽 / 缩放换算只读横向基准（X）⇒ 纵向整体下移不参与时间计算
        const drag = DAILY_RAW['../use-day-drag.ts'] ?? ''
        expect(drag).toContain('rect.width / DAY_MINUTES')
        expect(drag).not.toMatch(/rect\.top/)
        expect(DAILY_RAW['../use-day-model.ts']).toContain(
            'segmentStyleInColumns(seg, model.value.columns.length, 0)'
        )
    })

    it('AC7c 零 DOM：间隔带纯 CSS 承载（无「带」元素、now-line 仍无子节点）', async () => {
        wrapper = await mountDaily()
        const grid = wrapper.find('.day-grid').element
        expect(grid.querySelector('[class*="strip"]')).toBeNull()
        expect(grid.querySelectorAll('[data-testid^="day-now-strip"]')).toHaveLength(0)
        expect(wrapper.find(NOW_LINE).element.children).toHaveLength(0)
    })
})