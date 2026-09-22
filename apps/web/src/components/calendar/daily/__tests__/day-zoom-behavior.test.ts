// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref, type Ref } from 'vue'
import dayjs from 'dayjs'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '@nao-todo/presentation/task'
import { registry } from '@/commands/instance'
import { CALENDAR_KEY_SCOPE } from '@/components/calendar/monthly/keyboard-nav'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import DailyView from '../index.vue'
import { MIN_DAY_COLUMN_PX, dayAxisSpecOf, dayScrollWidthCss } from '../day-zoom'

/**
 * TASK-19 AC5 / AC6 / AC7（组件级 + 结构守卫；ADOPT ADR §3-D3 / §3-D5 / §5.4）
 *
 * 覆盖：
 *  - AC6：总宽公式 `max(k × 容器宽, 列数 × 20px)` 与下限 20px（jsdom 无法算 computed ⇒ 断言常量/公式字符串）。
 *  - AC7：缩放**不重拉**（`useCalendarTaskQuery` 不重建、`list` 不重发）。
 *  - AC7：月/周视图与 `host.vue` **零改动**（D5：缩放只在 `daily/index.vue` 内）。
 *  - AC5：缺失 `dayZoom` 时以 ×1 自足渲染、不抛错（readDayZoom 纯函数回退见 day-zoom.test.ts）。
 *  - 缩放入口 ①②③（ADR §5.3 #11 / PRD §5.4）：按钮 testid/aria/到端 disabled + 无复位按钮；
 *    `useShortcut` 三 id 注册（scope=CALENDAR_KEY_SCOPE）与卸载注销；`.day-body` ctrl+wheel 生效、非 ctrl 不变化。
 *
 * 注：新增文件，不改动既有断言（`daily-interactions.test.ts` 零改动）。
 */

const hoisted = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn(), create: vi.fn() }))

vi.mock('@/hooks', () => ({
    useTaskUseCase: () => ({
        list: hoisted.list,
        update: hoisted.update,
        create: hoisted.create
    })
}))

const TODAY = dayjs().format('YYYY-MM-DD')
const TASKS: TaskViewObject[] = [
    {
        id: 'a',
        name: '任务 a',
        state: 'todo',
        priority: 'low',
        startAt: `${TODAY} 09:00:00`,
        endAt: `${TODAY} 10:00:00`,
        createdAt: '2026-09-01 00:00:00',
        tags: []
    } as unknown as TaskViewObject
]

const buildContext = (dayZoom?: Ref<number>, setDayZoom?: (zoom: number) => void) => ({
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
    ...(dayZoom ? { dayZoom } : {}),
    ...(setDayZoom ? { setDayZoom } : {})
})

let wrapper: VueWrapper | null = null

const mountDaily = async (
    dayZoom?: Ref<number>,
    setDayZoom?: (zoom: number) => void
): Promise<VueWrapper> => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useTasksStore().addTasks(TASKS)
    wrapper = mount(DailyView, {
        attachTo: document.body,
        global: {
            plugins: [pinia],
            provide: { [CALENDAR_VIEW_CONTEXT_KEY as symbol]: buildContext(dayZoom, setDayZoom) }
        }
    })
    await flushPromises()
    return wrapper
}

/** 可交互挂载：提供 dayZoom ref + setDayZoom（按钮/快捷键/滚轮的写路径） */
const mountZoomable = async (initial = 1): Promise<{ w: VueWrapper; dayZoom: Ref<number> }> => {
    const dayZoom = ref(initial)
    const setDayZoom = (zoom: number): void => {
        dayZoom.value = zoom
    }
    const w = await mountDaily(dayZoom, setDayZoom)
    return { w, dayZoom }
}

const columnCount = (w: VueWrapper): number =>
    w.find('[data-testid="day-columns"]').element.children.length

const scrollWidth = (w: VueWrapper): string =>
    (w.find('.day-scroll').element as HTMLElement).style.width

// jsdom 归一化 CSS 函数（见 daily-view.test.ts 同注释）；用同一归一器比较。
const normalizeWidth = (css: string): string => {
    const el = document.createElement('div')
    el.style.width = css
    return el.style.width
}

beforeEach(() => {
    localStorage.clear()
    hoisted.list.mockReset().mockResolvedValue([
        {
            taskIds: TASKS.map((task) => task.id),
            pagination: { total: TASKS.length, page: 1, limit: 100, maxPage: 1 }
        },
        null
    ])
    hoisted.update.mockReset().mockResolvedValue(null)
    hoisted.create.mockReset().mockResolvedValue([{ id: 'new' }, null])
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('TASK-19 AC5 缺失 dayZoom ⇒ ×1 自足渲染（D6）', () => {
    it('context 无 dayZoom 时不抛错、按 ×1（48 列）渲染', async () => {
        const w = await mountDaily()
        expect(columnCount(w)).toBe(48)
    })
})

describe('TASK-19 AC6 总宽下限公式（D3 / §5.4）', () => {
    it('下限常量 20px，且各档字符串 = max(calc(k * 100%), calc(列数 * 20px))', () => {
        expect(MIN_DAY_COLUMN_PX).toBe(20)
        for (const zoom of [1, 1.5, 2, 3, 4] as const) {
            const spec = dayAxisSpecOf(zoom)
            expect(dayScrollWidthCss(zoom, spec.columns)).toBe(
                `max(calc(${zoom} * 100%), calc(${spec.columns} * ${MIN_DAY_COLUMN_PX}px))`
            )
        }
    })
})

describe('TASK-19 AC7 缩放不重拉（useCalendarTaskQuery 不重建 / list 不重发）', () => {
    it('挂载后切换档位 ⇒ list 仍只调用一次，且列数随档位变化', async () => {
        const dayZoom = ref(1)
        const w = await mountDaily(dayZoom)
        await flushPromises()
        expect(hoisted.list).toHaveBeenCalledTimes(1)
        expect(columnCount(w)).toBe(48)

        dayZoom.value = 2
        await nextTick()
        await flushPromises()
        expect(columnCount(w)).toBe(96)
        expect(hoisted.list).toHaveBeenCalledTimes(1)

        dayZoom.value = 4
        await nextTick()
        await flushPromises()
        expect(columnCount(w)).toBe(144)
        expect(hoisted.list).toHaveBeenCalledTimes(1)
    })
})

describe('TASK-19 AC7 月/周视图与宿主零改动（D5 / C8）', () => {
    // 结构守卫：zoom 只允许作用于 daily 子树（host.vue 零改动；月/周零改动）
    const sources = import.meta.glob(
        [
            '../../../../views/index/calendar/host.vue',
            '../../monthly/index.vue',
            '../../weekly/index.vue'
        ],
        { query: '?raw', import: 'default', eager: true }
    ) as Record<string, string>

    it('host.vue / monthly / weekly 均不引用日视图档位符号（day-zoom / dayZoom / DAY_ZOOM）', () => {
        const entries = Object.entries(sources)
        expect(entries).toHaveLength(3)
        for (const [path, source] of entries) {
            expect(source, `${path} 不应引用日视图档位符号`).not.toMatch(
                /day-zoom|dayZoom|DAY_ZOOM/
            )
        }
    })
})

describe('TASK-19 缩放入口①头部按钮（§5.4 / ADR §5.3 #11）', () => {
    it('+/− 按钮存在且 aria-label 正确；×1 时 − 禁用、+ 可用；不设独立复位按钮', async () => {
        const { w } = await mountZoomable()
        const plus = w.find('[data-testid="day-zoom-in"]')
        const minus = w.find('[data-testid="day-zoom-out"]')
        expect(plus.exists()).toBe(true)
        expect(minus.exists()).toBe(true)
        expect(plus.attributes('aria-label')).toBe('放大时间轴')
        expect(minus.attributes('aria-label')).toBe('缩小时间轴')
        expect(minus.attributes('disabled')).toBeDefined()
        expect(plus.attributes('disabled')).toBeUndefined()
        // 负向：不设独立复位按钮（复位 = Ctrl/⌘ 0）
        expect(w.find('[data-testid="day-zoom-reset"]').exists()).toBe(false)
    })

    it('点 + 逐级放大到 ×4（到端 + 禁用）；点 − 逐级返回 ×1（到端 − 禁用）', async () => {
        const { w, dayZoom } = await mountZoomable()
        const plus = () => w.find('[data-testid="day-zoom-in"]')
        const minus = () => w.find('[data-testid="day-zoom-out"]')

        await plus().trigger('click')
        expect(dayZoom.value).toBe(1.5)
        expect(scrollWidth(w)).toBe(normalizeWidth(dayScrollWidthCss(1.5, 48)))

        await plus().trigger('click')
        expect(dayZoom.value).toBe(2)
        expect(scrollWidth(w)).toBe(normalizeWidth(dayScrollWidthCss(2, 96)))

        await plus().trigger('click')
        expect(dayZoom.value).toBe(3)
        await plus().trigger('click')
        expect(dayZoom.value).toBe(4)
        expect(plus().attributes('disabled')).toBeDefined()

        await minus().trigger('click')
        expect(dayZoom.value).toBe(3)
        await minus().trigger('click')
        expect(dayZoom.value).toBe(2)
        await minus().trigger('click')
        expect(dayZoom.value).toBe(1.5)
        await minus().trigger('click')
        expect(dayZoom.value).toBe(1)
        expect(minus().attributes('disabled')).toBeDefined()
    })
})

describe('TASK-19 缩放入口②快捷键注册（§5.4 / ADR §5.3 #11）', () => {
    const IDS = ['calendar.dayzoom.in', 'calendar.dayzoom.out', 'calendar.dayzoom.reset']

    it('三条命令随挂载注册（scope=CALENDAR_KEY_SCOPE）且 execute 生效', async () => {
        const { w, dayZoom } = await mountZoomable(3)
        for (const id of IDS) {
            expect(registry.get(id), id).toBeDefined()
            expect(registry.get(id)?.keyboard?.scope, id).toBe(CALENDAR_KEY_SCOPE)
        }
        registry.execute(IDS[0]!)
        await nextTick()
        expect(dayZoom.value).toBe(4)
        registry.execute(IDS[2]!)
        await nextTick()
        expect(dayZoom.value).toBe(1)
        registry.execute(IDS[1]!)
        await nextTick()
        expect(dayZoom.value).toBe(1) // ×1 到端
        w.unmount()
        wrapper = null
    })

    it('日视图卸载后三条命令自动注销', async () => {
        const { w } = await mountZoomable()
        for (const id of IDS) expect(registry.get(id), id).toBeDefined()
        w.unmount()
        wrapper = null
        for (const id of IDS) expect(registry.get(id), id).toBeUndefined()
    })
})

describe('TASK-19 缩放入口③Ctrl/⌘ + 滚轮（§5.4 / ADR §5.3 #11）', () => {
    it('ctrl+wheel 改变档位且 preventDefault；非 ctrl 滚轮不改变', async () => {
        const { w, dayZoom } = await mountZoomable(2)
        const body = w.find('.day-body')
        expect(body.exists()).toBe(true)

        const wheel = (deltaY: number, ctrlKey: boolean): WheelEvent => {
            const event = new WheelEvent('wheel', {
                deltaY,
                ctrlKey,
                bubbles: true,
                cancelable: true
            })
            body.element.dispatchEvent(event)
            return event
        }

        // 方向不做假设：只要求 ctrl+wheel 改变档位，反向可恢复（×1/×4 到端除外，故起点取 ×2）
        const up = wheel(-100, true)
        await nextTick()
        expect(dayZoom.value).not.toBe(2)
        expect(up.defaultPrevented).toBe(true)

        wheel(100, true)
        await nextTick()
        expect(dayZoom.value).toBe(2)

        wheel(-100, false)
        await nextTick()
        expect(dayZoom.value).toBe(2) // 非 ctrl 不变化
    })
})