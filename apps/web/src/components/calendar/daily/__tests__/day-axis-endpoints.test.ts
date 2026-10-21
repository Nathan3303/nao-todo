// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref, type Ref } from 'vue'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import DailyView from '../index.vue'
import { buildDayGrid } from '../build-day-grid'
import { MIN_DAY_COLUMN_PX, dayAxisSpecOf, dayScrollWidthCss, type DayZoom } from '../day-zoom'

/**
 * T518 / DEF-78 日视图时间轴端点（PRD `docs/prds/2026-10-21-day-axis-endpoints.md` §5 R1–R6 / §7 AC1–AC5）
 * @description 只测**可断言部分**（结构 + 行为自证）；纯视觉观感（线重 / 留白 / 是否「收住」）由用户勾选。
 *  - AC1：×4（列宽触 20px 下限）下 00:00 / 24:00 各 1 条端点线 + 首/末标签文本；
 *  - AC1b（T518-R1 / R7）：内部标签一律居中 —— 末内部标签无 `is-last-tick`、首列仍 `is-first-tick`
 *    （含源级防回归：`index.css` / `index.vue` 中该字符串 0 次）；
 *  - AC2：首帧未测量（容器宽 ≤ 0 ⇒ 宽度回退 `列数 × 20px`）端点仍在、不丢失；
 *  - AC3：5 档 × {触下限列宽, 宽屏列宽} 枚举，末标签型式随档位（×1/×1.5 = `24`，×2/×3/×4 = `24:00`）；
 *  - AC4：回归基线 —— 内部格线修饰类 / `.day-axis-bg` 无子节点 / 刻度新建入口数量零变化；
 *  - AC5：端点样式仅用既有 `--cal-*`（无新增 token / 无 hex 字面量）、整像素落位、端标签非交互；
 *    **T518-R2**：端点线 `1px`（与内部小时线同粗细）+ 颜色不变；端标签 `padding: 0` / 首标签 `padding-left: 0`（贴边）。
 */

const ANCHOR = '2026-09-21'
const ZOOMS = [1, 1.5, 2, 3, 4] as const

/** 端标签型式（R2：×1 / ×1.5 沿用 `HH`，其余 `HH:MM`） */
const labelOf = (zoom: DayZoom, minutes: number): string =>
    dayAxisSpecOf(zoom).columnMinutes === 30
        ? String(Math.floor(minutes / 60)).padStart(2, '0')
        : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

const buildContext = (dayZoom: Ref<DayZoom>) => ({
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
    applyScope: () => {},
    dayZoom
})

const mountDaily = (zoom: DayZoom): VueWrapper => {
    const pinia = createPinia()
    setActivePinia(pinia)
    return mount(DailyView, {
        global: {
            plugins: [pinia],
            provide: { [CALENDAR_VIEW_CONTEXT_KEY as symbol]: buildContext(ref<DayZoom>(zoom)) }
        }
    })
}

const endpointEls = (w: VueWrapper): Element[] =>
    Array.from(w.find('.day-grid').element.querySelectorAll('.day-axis-endpoint'))

const headChildren = (w: VueWrapper): Element[] =>
    Array.from(w.find('[data-testid="day-columns"]').element.children)

// —— 源级断言辅助（jsdom 不应用 SFC CSS ⇒ 读原始样式文本，沿用 `daily-view.test.ts` 口径） ——
const DAILY_RAW = import.meta.glob(['../*.vue', '../*.css'], {
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

/** jsdom 无 `ResizeObserver`；最小替身用于触发 `useDayViewport` 的重测分支（AC3 宽屏列宽） */
class FakeResizeObserver {
    static instances: FakeResizeObserver[] = []
    private readonly callback: () => void
    constructor(callback: () => void) {
        this.callback = callback
        FakeResizeObserver.instances.push(this)
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    emit(): void {
        this.callback()
    }
}

describe('T518 AC3 端点语义进模型（R1 / R2 / R6：`axisEndpoints`）', () => {
    for (const zoom of ZOOMS) {
        it(`×${zoom} ⇒ 端点 {start 0 / end 1440}，端标签 ${labelOf(zoom, 0)} / ${labelOf(zoom, 1440)}，落位首列 / 末列`, () => {
            const spec = dayAxisSpecOf(zoom)
            const model = buildDayGrid(ANCHOR, [], Number.POSITIVE_INFINITY, ANCHOR, {
                columnMinutes: spec.columnMinutes
            })

            expect(model.axisEndpoints).toHaveLength(2)
            expect(model.axisEndpoints[0]).toEqual({
                key: 'start',
                minutes: 0,
                label: labelOf(zoom, 0),
                labelIndex: 0
            })
            expect(model.axisEndpoints[1]).toEqual({
                key: 'end',
                minutes: 1440,
                label: labelOf(zoom, 1440),
                labelIndex: spec.columns - 1
            })
        })
    }

    it('端点不进 `columns`：既有列头标签数与末列（空）零变化（内部刻度维持现状）', () => {
        for (const zoom of ZOOMS) {
            const spec = dayAxisSpecOf(zoom)
            const model = buildDayGrid(ANCHOR, [], Number.POSITIVE_INFINITY, ANCHOR, {
                columnMinutes: spec.columnMinutes
            })
            const labelled = model.columns.filter((col) => col.label !== '')
            expect(labelled, `×${zoom}`).toHaveLength(spec.columnMinutes === 30 ? 24 : 48)
            // 末列恒无内部标签 ⇒ 端标签落在末列不覆盖任何既有刻度（无重叠）
            expect(model.columns[spec.columns - 1]!.label).toBe('')
            // 末内部标签 → 端点 的间隔 = 该档位既有标注间隔（×1/×1.5 = 60min；其余 = 30min）
            const lastTickMin = labelled[labelled.length - 1]!.index * spec.columnMinutes
            expect(1440 - lastTickMin).toBe(spec.columnMinutes === 30 ? 60 : 30)
        }
    })
})

describe('T518 AC1 端点边界线（R1：00:00 / 24:00 各 1 条，日视图作用域）', () => {
    for (const zoom of ZOOMS) {
        it(`×${zoom} ⇒ 恰好 2 条端点线（is-start 0 / is-end 1440），DOM 增量与列数无关`, () => {
            const w = mountDaily(zoom)
            const els = endpointEls(w)
            expect(els).toHaveLength(2)
            expect(els[0]!.classList.contains('is-start')).toBe(true)
            expect(els[0]!.getAttribute('data-minutes')).toBe('0')
            expect(els[1]!.classList.contains('is-end')).toBe(true)
            expect(els[1]!.getAttribute('data-minutes')).toBe('1440')
            // 纯视觉层：不拦截指针（任务条 / pan 命中零变化）；不进 `.day-axis-bg`（禁 列数×N 背景 DOM）
            for (const el of els) expect(el.getAttribute('aria-hidden')).toBe('true')
            expect(w.find('[data-testid="day-axis-bg"]').element.children).toHaveLength(0)
            w.unmount()
        })
    }
})

describe('T518 AC1 / AC3 端标签（R2 / D1：首 `00:00` 左对齐、末 `24:00` 右对齐）', () => {
    for (const zoom of ZOOMS) {
        it(`×${zoom} ⇒ 末标签 = ${labelOf(zoom, 1440)}、首标签 = ${labelOf(zoom, 0)}，且非交互（C5 入口零变化）`, () => {
            const spec = dayAxisSpecOf(zoom)
            const w = mountDaily(zoom)
            const heads = headChildren(w)
            expect(heads).toHaveLength(spec.columns)

            // 末标签：末列承载，右对齐于轴终点（不新增 DOM 子节点 ⇒ 列头子节点数仍 = 列数）
            const endHead = heads[spec.columns - 1]!
            expect(endHead.classList.contains('is-axis-end')).toBe(true)
            const endLabel = endHead.querySelector('.day-axis-end-label')
            expect(endLabel).not.toBeNull()
            expect((endLabel!.textContent ?? '').trim()).toBe(labelOf(zoom, 1440))
            // 非交互：不是 button ⇒ 不产生「24 点创建任务」歧义入口；也不占用 `.day-col-label`
            expect(endLabel!.tagName).toBe('SPAN')
            expect(endLabel!.querySelector('button')).toBeNull()

            // 首标签：首列左对齐（`.is-first-tick`），文本与档位型式一致
            const firstHead = heads[0]!
            expect(firstHead.classList.contains('is-first-tick')).toBe(true)
            expect((firstHead.textContent ?? '').trim()).toBe(labelOf(zoom, 0))
            expect(firstHead.querySelector('button.day-col-label')).not.toBeNull()

            // 回归：刻度按钮数量与位置零变化（端标签不是 `.day-col-label`）
            const labels = w.findAll('.day-col-label')
            expect(labels).toHaveLength(spec.columnMinutes === 30 ? 24 : 48)
            w.unmount()
        })
    }
})

describe('T518-R1 AC1b 内部标签一律居中（R7：撤销末列右对齐保护）', () => {
    for (const zoom of ZOOMS) {
        it(`×${zoom} ⇒ 末内部标签无 \`is-last-tick\`（居中）、首列仍 \`is-first-tick\``, () => {
            const spec = dayAxisSpecOf(zoom)
            const w = mountDaily(zoom)
            const heads = headChildren(w)
            const tickHeads = heads.filter((el) => !!el.querySelector('.day-col-label'))
            expect(tickHeads).toHaveLength(spec.columnMinutes === 30 ? 24 : 48)

            // R7：末内部标签与其余内部标签同类（不再右对齐），全列头不得残留该类
            const lastTick = tickHeads[tickHeads.length - 1]!
            expect(lastTick.classList.contains('is-last-tick')).toBe(false)
            expect(lastTick.querySelector('.is-last-tick')).toBeNull()
            expect(heads.filter((el) => el.querySelector('.is-last-tick'))).toHaveLength(0)
            // 末内部标签仍在（只改对齐，不删标签）；末列仍是端标签
            const tickStepMin = spec.columnMinutes === 30 ? 60 : 30
            const lastTickMin = Math.floor((1440 - 1) / tickStepMin) * tickStepMin
            expect((lastTick.textContent ?? '').trim()).toBe(labelOf(zoom, lastTickMin))
            expect(heads[spec.columns - 1]!.classList.contains('is-axis-end')).toBe(true)

            // 首端保护保留（AC1b：`00:00` 仍左对齐）
            expect(heads[0]!.classList.contains('is-first-tick')).toBe(true)
            expect(heads.filter((el) => el.classList.contains('is-first-tick'))).toHaveLength(1)
            w.unmount()
        })
    }

    it('源级防回归：`index.css` 与 `index.vue` 中 `is-last-tick` 出现次数 = 0', () => {
        for (const [path, source] of Object.entries(DAILY_RAW)) {
            if (!path.endsWith('/index.css') && !path.endsWith('/index.vue')) continue
            const hits = source.split('is-last-tick').length - 1
            expect(hits, `${path} 不得残留 is-last-tick`).toBe(0)
        }
        // 首端保护的源码仍在（只删末列的）
        expect(cssRule(dailyStyle(), '.day-col-head.is-first-tick .day-col-label')).toContain(
            'transform: translateX(0)'
        )
    })
})

describe('T518 AC2 首帧未测量（容器宽 ≤ 0 ⇒ 回退 列数 × 20px）', () => {
    for (const zoom of ZOOMS) {
        it(`×${zoom} ⇒ 宽度 = 列数 × 20px，端点线 / 端标签均不丢失、不越界`, () => {
            const spec = dayAxisSpecOf(zoom)
            const w = mountDaily(zoom)
            const scroll = w.find('.day-scroll').element as HTMLElement
            // jsdom 无布局 ⇒ `clientWidth = 0` ⇒ 与实现同源公式比较（整数列宽）
            expect(scroll.style.width).toBe(dayScrollWidthCss(zoom, spec.columns, 0))
            expect(scroll.style.width).toBe(`${spec.columns * MIN_DAY_COLUMN_PX}px`)

            expect(endpointEls(w)).toHaveLength(2)
            const heads = headChildren(w)
            expect((heads[spec.columns - 1]!.textContent ?? '').trim()).toBe(labelOf(zoom, 1440))
            w.unmount()
        })
    }
})

describe('T518 AC3 宽屏列宽（5 档 × 宽屏）', () => {
    for (const zoom of ZOOMS) {
        it(`×${zoom}（容器 1600px）⇒ 宽度随档位重算、每列整数 ≥ 20px，端点 / 端标签不变`, async () => {
            const spec = dayAxisSpecOf(zoom)
            const original = globalThis.ResizeObserver
            globalThis.ResizeObserver =
                FakeResizeObserver as unknown as typeof globalThis.ResizeObserver
            FakeResizeObserver.instances = []
            try {
                const w = mountDaily(zoom)
                const body = w.find('.day-body').element as HTMLElement
                Object.defineProperty(body, 'clientWidth', { value: 1600, configurable: true })
                FakeResizeObserver.instances.at(-1)!.emit()
                await nextTick()

                const widthCss = (w.find('.day-scroll').element as HTMLElement).style.width
                expect(widthCss).toBe(dayScrollWidthCss(zoom, spec.columns, 1600))
                // 整像素（R4）：总宽 / 列数 = 整数列宽 ⇒ 0 / 100% 端点均落整像素
                const perColumn = Number.parseInt(widthCss, 10) / spec.columns
                expect(Number.isInteger(perColumn)).toBe(true)
                expect(perColumn).toBeGreaterThanOrEqual(MIN_DAY_COLUMN_PX)
                expect(zoom * 1600).toBeLessThanOrEqual(Number.parseInt(widthCss, 10))

                expect(endpointEls(w)).toHaveLength(2)
                expect(w.findAll('.day-axis-end-label')).toHaveLength(1)
                w.unmount()
            } finally {
                globalThis.ResizeObserver = original
            }
        })
    }
})

describe('T518 AC4 回归基线（内部格线 / 列头结构零变化）', () => {
    for (const zoom of ZOOMS) {
        it(`×${zoom} ⇒ 格线修饰类与列头子节点数仍按档位（未引入新格线层）`, () => {
            const spec = dayAxisSpecOf(zoom)
            const w = mountDaily(zoom)
            const bg = w.find('[data-testid="day-axis-bg"]')
            expect(bg.classes()).toContain('day-col-lines')
            expect(bg.classes()).toContain(`day-col-lines--${spec.columnMinutes}`)
            expect(headChildren(w)).toHaveLength(spec.columns)
            // 端点层不参与格线链：`.day-axis-endpoint` 不带 `.day-col-lines`
            for (const el of endpointEls(w))
                expect(el.classList.contains('day-col-lines')).toBe(false)
            w.unmount()
        })
    }
})

describe('T518 AC5 设计一致性（源级：复用 `--cal-*` / 整像素 / 日视图限定）', () => {
    it('端点线：仅既有 `--cal-*`（无 hex / rgb / hsl 字面量）、**与内部小时线同粗细（1px，T518-R2）**、锚在轴两端', () => {
        const css = dailyStyle()
        const base = cssRule(css, '.day-axis-endpoint')
        expect(base).not.toBe('')
        // T518-R2（R1 修订）：`2px → 1px`（与内部小时线同粗细），仅靠颜色区分
        expect(base).toMatch(/width:\s*1px;/)
        expect(base).not.toMatch(/width:\s*2px/)
        expect(base).toContain('var(--cal-fg)')
        expect(base).toContain('var(--cal-bg)')
        // R2 修订：**颜色一字不改**（更深的 `--cal-fg` 55% over `--cal-bg`）
        expect(base).toContain('background: color-mix(in srgb, var(--cal-fg) 55%, var(--cal-bg));')
        expect(base).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)
        expect(base).toContain('pointer-events: none')

        expect(cssRule(css, '.day-axis-endpoint.is-start')).toContain('left: 0')
        expect(cssRule(css, '.day-axis-endpoint.is-end')).toContain('right: 0')
        // R6：端点位置来自模型（0 / 轴终点），CSS 不写端点坐标魔数
        expect(base).not.toMatch(/(left|right)\s*:\s*\d+px/)
    })

    it('端标签：右对齐于轴终点（left 100% + translateX(-100%)）、不裁切、复用 `--cal-fg`', () => {
        const css = dailyStyle()
        const label = cssRule(css, '.day-col-head.is-axis-end .day-axis-end-label')
        expect(label).not.toBe('')
        expect(label).toContain('left: 100%')
        expect(label).toContain('transform: translateX(-100%)')
        expect(label).toContain('white-space: nowrap')
        expect(label).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)
        expect(cssRule(css, '.day-col-head.is-axis-end')).toContain('var(--cal-fg)')
    })

    it('T518-R2 端标签贴边：末标签 `padding: 0`、首标签 `padding-left: 0`（中间标签 `0 6px` 不变）', () => {
        const css = dailyStyle()
        // 末标签：`24` 文字右缘贴轴右端（不能是 `0 6px`）
        const endLabel = cssRule(css, '.day-col-head.is-axis-end .day-axis-end-label')
        expect(endLabel).toMatch(/padding:\s*0\s*;/)
        expect(endLabel).not.toMatch(/padding:\s*0\s+6px/)
        // 首标签：`00` 文字左缘贴轴左端；右侧 padding 保留（点击热区）
        const firstLabel = cssRule(css, '.day-col-head.is-first-tick .day-col-label')
        expect(firstLabel).toContain('padding-left: 0')
        expect(firstLabel).not.toMatch(/padding-right:\s*0\s*;/)
        // 中间标签维持现状
        expect(cssRule(css, '.day-col-label')).toMatch(/padding:\s*0\s+6px\s*;/)
    })

    it('R5 作用域限定：周 / 月 / 宿主视图零引用端点类名（不继承）', () => {
        const others = import.meta.glob(
            [
                '../../../../views/index/calendar/host.vue',
                '../../monthly/index.vue',
                '../../weekly/index.vue'
            ],
            { query: '?raw', import: 'default', eager: true }
        ) as Record<string, string>
        const entries = Object.entries(others)
        expect(entries).toHaveLength(3)
        for (const [path, source] of entries) {
            expect(source, `${path} 不应引用日视图端点类名`).not.toMatch(
                /day-axis-endpoint|day-axis-end-label/
            )
        }
    })
})