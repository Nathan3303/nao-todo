// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import dayjs from 'dayjs'
import { nextTick, ref } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '@nao-todo/presentation/task'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { nueUI } from '@/nue-ui-register'
import DailyView from '../index.vue'

/**
 * T518-R3 / R4 / R5 当前时间线顶端时刻文本（PRD §5 R8–R11 / §7 AC6a–AC6d · AC7a–AC7d · AC8a–AC8d）
 * @description 只测**可断言部分**（文本 / 类名 / inline 位移 / 源级样式口径 / DOM 与定时器增量）；
 *              像素级观感由用户视觉勾选。
 *  - AC8a：文本水平中心 = 线 x（`-50%` 居中 + 偏移 0）、线身让出带宽、圆点与文本盒不重叠；
 *  - AC8b：视口贴边（组件级行为断言 + `now-label.test.ts` 纯函数枚举）、无 transition / animation；
 *  - AC8c：滚动帧内无布局读取、宽度缓存失效点覆盖 resize / 档位 / 切日、定时器仍 1 处；
 *  - AC8d：`.day-axis-bg` 让带且保留其余三边；端点线仍贯穿（`top: 0`、不消费带高）。
 */

const NOW_LINE = '.day-now-line'
const NOW_LABEL = '.day-now-label'

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
const pxOf = (rule: string, prop: string): number => {
    const matched = new RegExp(`${prop}:\\s*(-?[\\d.]+)px`).exec(rule)
    return Number.parseFloat(matched?.[1] ?? 'NaN')
}
const countOf = (source: string, needle: string): number => source.split(needle).length - 1

/** jsdom 无 `ResizeObserver`；最小替身用于触发容器宽重测（AC8b 视口贴边） */
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

const nextFrame = (): Promise<void> =>
    new Promise((resolve) => requestAnimationFrame(() => resolve()))

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
    it('今天 ⇒ 文本 `HH:mm`（两位补零、与 now 一致），`data-now` 同步', async () => {
        wrapper = await mountDaily()
        const line = wrapper.find(NOW_LINE)
        const label = wrapper.find(NOW_LABEL)
        expect(line.exists()).toBe(true)
        expect(label.exists()).toBe(true)
        expect(label.text()).toBe('12:00')
        expect(label.text()).toBe(dayjs().format('HH:mm'))
        expect(line.attributes('data-now')).toBe('12:00')
        // 既有圆点 / aria 口径不变（a11y：视觉专属，PM 裁定保持）
        expect(line.attributes('aria-hidden')).toBe('true')
        expect(cssRule(dailyStyle(), '.day-now-line::before')).toContain('border-radius: 50%')
        // DOM 恒定量：now-line 恰 1 个子节点（文本），与列数无关
        expect(line.element.children).toHaveLength(1)
    })

    it('非今天 ⇒ 不渲染（跟随既有 `v-if="model.isToday"`）', async () => {
        wrapper = await mountDaily()
        expect(wrapper.find(NOW_LINE).exists()).toBe(true)
        await wrapper.find('[title="前一天"]').trigger('click')
        await flushPromises()
        expect(wrapper.find(NOW_LINE).exists()).toBe(false)
        expect(wrapper.find(NOW_LABEL).exists()).toBe(false)
    })

    it('30 秒时基自动刷新（沿用既有定时器，不新增第二个）', async () => {
        vi.useFakeTimers({ toFake: ['Date', 'setInterval'] })
        vi.setSystemTime(new Date('2026-09-21T12:00:00'))
        wrapper = await mountDaily()
        expect(wrapper.find(NOW_LABEL).text()).toBe('12:00')

        await vi.advanceTimersByTimeAsync(30_000)
        expect(wrapper.find(NOW_LABEL).text()).toBe('12:00') // 30s 内不跳分钟
        await vi.advanceTimersByTimeAsync(30_000)
        expect(wrapper.find(NOW_LABEL).text()).toBe('12:01')
    })
})

describe('T518-R5 AC8a 文本位置（居中于线 + 线头正上方）', () => {
    it('水平居中：`left: 0`（起于线 x）+ `-50%` 位移；无钳制时偏移为 0', async () => {
        wrapper = await mountDaily()
        const label = wrapper.find(NOW_LABEL)
        const transform = (label.element as HTMLElement).style.transform
        expect(transform).toContain('translateX(calc(-50% + 0px))')
        expect(cssRule(dailyStyle(), '.day-now-label')).toContain('left: 0')
    })

    it('线身让出带宽（`top: var(--day-now-band)`）且仍画到格底（`bottom: 0`）', () => {
        const rule = cssRule(dailyStyle(), '.day-now-line')
        expect(rule).toContain('top: var(--day-now-band)')
        expect(rule).toContain('bottom: 0')
    })

    it('圆点与文本盒不重叠：文本盒底 16 ≤ 圆点顶 17（带高 24 / 圆点 7 / 文本盒底边距 8）', () => {
        const css = dailyStyle()
        const band = pxOf(cssRule(css, '.nue-calendar-daily'), '--day-now-band')
        const bottomOffset = Number.parseFloat(
            /bottom:\s*calc\(100% \+ ([\d.]+)px\)/.exec(cssRule(css, '.day-now-label'))![1]!
        )
        const dot = cssRule(css, '.day-now-line::before')
        const dotTop = pxOf(dot, 'top')
        const dotHeight = pxOf(dot, 'height')
        expect(band).toBe(26)
        const textBottom = band - bottomOffset
        const dotTopY = band + dotTop
        expect(textBottom).toBeLessThanOrEqual(dotTopY) // 不重叠
        expect(dotTopY + dotHeight).toBeLessThanOrEqual(band) // 圆点完全在带内（R11 口径）
    })

    it('文本盒完整落在带内（AC7a/AC7d：盒顶 2.4 ≥ 0、盒高 15.6 + 圆点 7 = 22.6 ≤ 26）', () => {
        const css = dailyStyle()
        const band = pxOf(cssRule(css, '.nue-calendar-daily'), '--day-now-band')
        const label = cssRule(css, '.day-now-label')
        const bottomOffset = Number.parseFloat(
            /bottom:\s*calc\(100% \+ ([\d.]+)px\)/.exec(label)![1]!
        )
        const fontSizeRem = Number.parseFloat(/font-size:\s*([\d.]+)rem/.exec(label)![1]!)
        const lineHeight = Number.parseFloat(/line-height:\s*([\d.]+)/.exec(label)![1]!)
        // ⚠️ `16` 只是**默认根字号假设**（仓内没有 `html { font-size }`；`:root` 的
        //    `--nue-primary-font-size` 是变量、与 `rem` 无关）⇒ 真实根字号是浏览器默认值且用户可改。
        //    因此「盒顶 ≥ 0」对根字号有上限：`带高 − 8 ≥ 0.975 × root` ⇒ 26px 带高容忍 root ≤ 18.46px（+15%）。
        //    本用例按 16 断言具体数值，另由下一条用例断言「容忍上限 ≥ 18px」这一约束本身。
        const textHeight = fontSizeRem * 16 * lineHeight // 默认根字号 16 ⇒ 15.6px
        const dotHeight = pxOf(cssRule(css, '.day-now-line::before'), 'height')
        const textBottom = band - bottomOffset
        const textTop = textBottom - textHeight
        expect(textTop).toBeGreaterThanOrEqual(0)
        expect(textHeight + dotHeight).toBeLessThanOrEqual(band)
        expect(textTop).toBeCloseTo(2.4, 5)

        // T518-R5c：把「根字号可放大」这条约束本身钉死 —— 容忍上限 = (带高 − 底边偏移) / 0.975
        // 根字号 16 时的 2.4px 余量只允许 +15%（≈18.46px）；要求 ≥18px，防止将来调小带高时静默失守。
        const rootFontCeiling = (band - bottomOffset) / (fontSizeRem * lineHeight)
        expect(rootFontCeiling).toBeGreaterThanOrEqual(18)
        expect(rootFontCeiling).toBeCloseTo(18.46, 2)
    })
})

describe('T518-R5 AC8b 视口贴边（组件级行为断言）', () => {
    it('居中有空间 ⇒ 居中；靠右可见边缘 ⇒ 贴边；滚回中部 ⇒ 恢复居中', async () => {
        const originalRO = globalThis.ResizeObserver
        const widthSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(40)
        globalThis.ResizeObserver =
            FakeResizeObserver as unknown as typeof globalThis.ResizeObserver
        FakeResizeObserver.instances = []
        try {
            wrapper = await mountDaily()
            const body = wrapper.find('.day-body').element as HTMLElement
            Object.defineProperty(body, 'clientWidth', { value: 200, configurable: true })
            FakeResizeObserver.instances.at(-1)!.emit() // 容器宽 200 ⇒ ×1 触下限轴 960px
            await nextTick()

            const label = wrapper.find(NOW_LABEL).element as HTMLElement
            const transformAt = async (scrollLeft: number): Promise<string> => {
                body.scrollLeft = scrollLeft
                body.dispatchEvent(new Event('scroll'))
                await nextFrame()
                await nextTick()
                return label.style.transform
            }
            // 12:00 ⇒ 线 x = 480；文本 40px（半宽 20）
            expect(await transformAt(380)).toContain('0px') // 居中
            // 下界 = 600 + 20 = 620 ⇒ 右移 140（文本盒左缘贴可见左边缘后仍不越界）
            expect(await transformAt(600)).toContain('140px')
            expect(await transformAt(380)).toContain('0px') // 滚回中部恢复居中
        } finally {
            globalThis.ResizeObserver = originalRO
            widthSpy.mockRestore()
        }
    })

    it('禁 transition / animation（与「不得抖动」冲突）', () => {
        const rule = cssRule(dailyStyle(), '.day-now-label')
        expect(rule).toContain('transition: none')
        expect(rule).toContain('animation: none')
    })

    it('纯函数枚举见 `now-label.test.ts`（居中 / 左贴边 / 右贴边 / 轴端点 / 双约束 / 连续性）', () => {
        // 本用例仅作交叉引用，防止两处口径分叉
        expect(DAILY_RAW['../now-label.ts']).toContain('nowLabelLayoutOf')
        expect(DAILY_RAW['../use-day-viewport.ts']).toContain('nowLabelLayoutOf(')
    })
})

describe('T518-R5 AC8c 跟随纪律（滚动帧内无布局读取 / 定时器唯一）', () => {
    const fnBody = (source: string, marker: string): string => {
        const start = source.indexOf(marker)
        if (start < 0) return ''
        const end = source.indexOf('\n    }', start)
        return end < 0 ? source.slice(start) : source.slice(start, end)
    }

    it('`onBodyScroll` 内无 `getBoundingClientRect` / `offsetWidth` / `getComputedStyle`（只读 `scrollLeft`）', () => {
        const body = fnBody(DAILY_RAW['../use-day-viewport.ts'] ?? '', 'const onBodyScroll = ')
        expect(body).not.toBe('')
        expect(body).toContain('scrollLeft')
        expect(body).not.toMatch(/getBoundingClientRect|offsetWidth|offsetHeight|getComputedStyle/)
        // rAF 批处理（既有纪律）
        expect(body).toContain('requestAnimationFrame')
    })

    it('宽度缓存失效点覆盖 文本 / 档位 / 切日 / resize', () => {
        const source = DAILY_RAW['../use-day-viewport.ts'] ?? ''
        expect(source).toContain('measureNowLabel')
        expect(source).toMatch(
            /watch\(\s*\[nowText, dayZoom, containerW, \(\) => model\.value\.anchorKey\]/
        )
        // resize ⇒ 重测（ResizeObserver 回调内）
        const roBody = fnBody(source, 'resizeObserver = new ResizeObserver(')
        expect(roBody).toContain('measureNowLabel')
    })

    it('定时器仍只有 1 处（30s），模板 / 样式 / 纯函数均无定时器', () => {
        expect(countOf(DAILY_RAW['../use-day-viewport.ts'] ?? '', 'setInterval(')).toBe(1)
        expect(countOf(DAILY_RAW['../index.vue'] ?? '', 'setInterval(')).toBe(0)
        expect(countOf(DAILY_RAW['../index.css'] ?? '', 'setInterval(')).toBe(0)
        expect(countOf(DAILY_RAW['../now-label.ts'] ?? '', 'setInterval(')).toBe(0)
    })
})

describe('T518-R5 AC8d 间隔带内不画格线（端点线保留贯穿）', () => {
    it('`.day-axis-bg` 让带且**保留其余三边**（防层塌陷）', () => {
        const rule = cssRule(dailyStyle(), '.day-axis-bg')
        expect(rule).toContain('top: var(--day-now-band)')
        expect(rule).toContain('right: 0')
        expect(rule).toContain('bottom: 0')
        expect(rule).toContain('left: 0')
        // 注释里提到 track 用的 `inset: 0` 不算声明 ⇒ 只查真正的声明行
        expect(rule).not.toMatch(/^\s*inset\s*:/m)
    })

    it('`.day-axis-endpoint` 仍贯穿整列（`top: 0`、不消费带高）', () => {
        const rule = cssRule(dailyStyle(), '.day-axis-endpoint')
        expect(rule).toContain('top: 0')
        expect(rule).not.toContain('day-now-band')
    })

    it('`.day-axis-track` 保持 `inset: 0`（arch 裁定：唯一消费方是 `rect.width`）', () => {
        const rule = cssRule(dailyStyle(), '.day-axis-track')
        expect(rule).toContain('inset: 0')
        expect(rule).not.toContain('day-now-band')
    })

    it('带下缘不补横线（不新增分隔线：`.day-grid` 无 border / 无新伪元素）', () => {
        const rule = cssRule(dailyStyle(), '.day-grid')
        expect(rule).not.toMatch(/border/)
        expect(cssRule(dailyStyle(), '.day-grid::after')).toBe('')
    })
})

describe('T518-R4 AC7 间隔带（26px 单一来源 / 恒定 / lane 相对映射不变）', () => {
    it('AC7d 带高单一来源：`--day-now-band` 定义仅 1 处（26px），只有泳道层消费该变量', () => {
        const css = DAILY_RAW['../index.css'] ?? ''
        expect(countOf(css, '--day-now-band:')).toBe(1)
        expect(pxOf(cssRule(css, '.nue-calendar-daily'), '--day-now-band')).toBe(26)
        expect(countOf(css, 'var(--day-now-band)')).toBe(3) // 泳道层 / 格线层 / 线身
        expect(cssRule(css, '.day-grid .cal-lanes')).toContain('top: var(--day-now-band)')
        expect(cssRule(css, '.day-grid')).not.toMatch(/padding-top/)
    })

    it('AC7a 带恒定存在：非今天无文本，泳道层仍在且偏移规则无条件', async () => {
        const css = DAILY_RAW['../index.css'] ?? ''
        expect(cssRule(css, '.day-grid .cal-lanes')).not.toMatch(/is-today|day-now-line/)
        wrapper = await mountDaily()
        expect(wrapper.find('.day-grid .cal-lanes').exists()).toBe(true)
        await wrapper.find('[title="前一天"]').trigger('click')
        await flushPromises()
        expect(wrapper.find(NOW_LINE).exists()).toBe(false)
        expect(wrapper.find('.day-grid .cal-lanes').exists()).toBe(true)
    })

    it('AC7b / R5b 贴端类名整组删除（轴端约束已在纯函数内）⇒ 源码 0 处 + 组件 classList 不含', async () => {
        const sources = [
            ['index.vue', DAILY_RAW['../index.vue'] ?? ''],
            ['index.css', DAILY_RAW['../index.css'] ?? ''],
            ['use-day-viewport.ts', DAILY_RAW['../use-day-viewport.ts'] ?? '']
        ] as const
        for (const [name, source] of sources) {
            expect(source.length, name).toBeGreaterThan(0)
            expect(countOf(source, 'is-near-start'), name).toBe(0)
            expect(countOf(source, 'is-near-end'), name).toBe(0)
        }
        // 孤儿符号（`nowEdge` / 阈值常量）一并清除，防死代码回流
        const viewport = DAILY_RAW['../use-day-viewport.ts'] ?? ''
        expect(countOf(viewport, 'nowEdge')).toBe(0)
        expect(countOf(viewport, 'NOW_EDGE_MINUTES')).toBe(0)

        // 组件断言：常态（12:00）与 R3 时代会加类的时刻（00:05）都不带这两个类名
        wrapper = await mountDaily()
        expect(wrapper.find(NOW_LINE).classes()).not.toContain('is-near-start')
        expect(wrapper.find(NOW_LINE).classes()).not.toContain('is-near-end')
        wrapper.unmount()
        wrapper = null
        freezeAt('2026-09-21T00:05:00')
        wrapper = await mountDaily()
        expect(wrapper.find(NOW_LINE).classes()).not.toContain('is-near-start')
        expect(wrapper.find(NOW_LINE).classes()).not.toContain('is-near-end')

        // 圆点恒与线同轴心（R10）且在带内（R11）
        const dot = cssRule(DAILY_RAW['../index.css'] ?? '', '.day-now-line::before')
        expect(dot).toContain('left: -3px')
        expect(dot).toContain('top: -7px')
    })

    it('AC7c lane → 纵坐标相对映射不变：任务条自身 top 仍为 lane × 步长', async () => {
        wrapper = await mountDaily([TASK_AT_0900])
        const seg = wrapper.find('[data-testid="day-task"]').element.parentElement as HTMLElement
        expect(seg.classList.contains('day-seg')).toBe(true)
        expect(seg.style.top).toBe('0px')
        const drag = DAILY_RAW['../use-day-drag.ts'] ?? ''
        expect(drag).toContain('rect.width / DAY_MINUTES')
        expect(drag).not.toMatch(/rect\.top/)
        expect(DAILY_RAW['../use-day-model.ts']).toContain(
            'segmentStyleInColumns(seg, model.value.columns.length, 0)'
        )
    })
})

describe('T518-R3 AC6c / AC6d 负向闭环与设计一致性', () => {
    it('AC6c `nowLeft` 语义不变（12:00 ⇒ 50%），线 / 文本均不拦截指针', async () => {
        wrapper = await mountDaily()
        expect((wrapper.find(NOW_LINE).element as HTMLElement).style.left).toBe('50%')
        expect(cssRule(dailyStyle(), '.day-now-line')).toContain('pointer-events: none')
        expect(cssRule(dailyStyle(), '.day-now-label')).toContain('pointer-events: none')
    })

    it('AC6d 文本仅用既有 `--nue-error-color-60`，无 hex / rgb / hsl、无底色 / 气泡 / padding', () => {
        const rule = cssRule(dailyStyle(), '.day-now-label')
        expect(rule).toContain('color: var(--nue-error-color-60)')
        expect(rule).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)
        expect(rule).not.toMatch(
            /(^|[;{\s])(background|border|border-radius|box-shadow|padding)\s*:/
        )
        expect(rule).toContain('font-size: 0.65rem')
        // 圆点仍在（R8：保留既有顶部圆点）
        expect(cssRule(dailyStyle(), '.day-now-line::before')).toContain(
            'background: var(--nue-error-color-60)'
        )
    })
})