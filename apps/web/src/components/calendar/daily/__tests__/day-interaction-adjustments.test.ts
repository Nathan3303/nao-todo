// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, inject, nextTick, ref, type Ref } from 'vue'
import dayjs from 'dayjs'
import { TASK_CREATOR_DIALOG_KEY } from '@nao-todo/shared'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '@nao-todo/presentation/task'
import { registry } from '@/commands/instance'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { nueUI } from '@/nue-ui-register'
import { CALENDAR_KEY_SCOPE } from '../../monthly/keyboard-nav'
import { useCalendarHost } from '../../use-calendar-host'
import TaskBar from '../../monthly/task-bar.vue'
import { CALENDAR_DAY_CONTEXT_KEY, type CalendarDayContext } from '../context'
import DailyView from '../index.vue'

/**
 * TASK-19 追加批次（T84）交互调整：全天只读条 / 两侧手柄 / sticky 名称 / 格线档位修饰 / 结构性能
 * 依据：PRD `2026-09-22-day-view-adjustments.md` AC2–AC4 / AC6 / AC10；交互契约 ADR C1/C2/C3/C6/C7/C8。
 *
 * jsdom 不可断言项（见 ADR §4 人工验收）：sticky 实际贴边与不越出条、`clip-path` 副作用、
 * 标签居中像素、遮罩显示条件、帧率。此处只做**结构断言**。
 *
 * 注：新增文件；`daily-interactions.test.ts`（契约变更 A）与 `daily-view.test.ts`（契约变更 B）另行处理。
 */

const hoisted = vi.hoisted(() => ({
    list: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    open: vi.fn()
}))

vi.mock('@/hooks', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/hooks')>()
    return {
        ...actual,
        useTaskUseCase: () => ({
            list: hoisted.list,
            update: hoisted.update,
            create: hoisted.create
        })
    }
})

// 专注徽标会拉取 pomodoro 记录（jsdom 无后端）：替换为无害返回值
vi.mock('@/components/calendar/monthly/use-pomodoro-badge', async () => {
    const { ref: vueRef } = await import('vue')
    return { usePomodoroBadge: () => ({ badgeLabel: vueRef<string | null>(null) }) }
})

const TODAY = dayjs().format('YYYY-MM-DD')
const YESTERDAY = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
const TOMORROW = dayjs().add(1, 'day').format('YYYY-MM-DD')

const taskOf = (input: {
    id: string
    startAt: string | null
    endAt: string | null
}): TaskViewObject =>
    ({
        id: input.id,
        name: `任务 ${input.id}`,
        state: 'todo',
        priority: 'low',
        startAt: input.startAt,
        endAt: input.endAt,
        createdAt: '2026-09-01 00:00:00',
        tags: []
    }) as unknown as TaskViewObject

const TASKS: TaskViewObject[] = [
    taskOf({ id: 'n', startAt: `${TODAY} 09:00:00`, endAt: `${TODAY} 10:00:00` }),
    // 续接段：昨 22:00 → 今 02:00（isStart=false）
    taskOf({ id: 'cs', startAt: `${YESTERDAY} 22:00:00`, endAt: `${TODAY} 02:00:00` }),
    // 续接段：今 22:00 → 明 02:00（isEnd=false）
    taskOf({ id: 'ce', startAt: `${TODAY} 22:00:00`, endAt: `${TOMORROW} 02:00:00` }),
    // 全天：仅 endAt
    taskOf({ id: 'ae', startAt: null, endAt: `${TODAY} 10:00:00` }),
    // 全天：跨整天
    taskOf({ id: 'fs', startAt: `${YESTERDAY} 00:00:00`, endAt: `${TOMORROW} 00:00:00` })
]

const buildContext = (dayZoom?: Ref<number>) => ({
    dialogManager: { open: hoisted.open },
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
    ...(dayZoom ? { dayZoom } : {})
})

let wrapper: VueWrapper | null = null

const mountDaily = async (dayZoom?: Ref<number>): Promise<VueWrapper> => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useTasksStore().addTasks(TASKS)
    wrapper = mount(DailyView, {
        attachTo: document.body,
        global: {
            plugins: [pinia],
            provide: { [CALENDAR_VIEW_CONTEXT_KEY as symbol]: buildContext(dayZoom) }
        }
    })
    await flushPromises()
    return wrapper
}

const stubRect = (el: Element, left: number, width: number): void => {
    el.getBoundingClientRect = () =>
        ({
            left,
            top: 0,
            width,
            height: 100,
            right: left + width,
            bottom: 100,
            x: left,
            y: 0,
            toJSON: () => ({})
        }) as DOMRect
}

const pointer = (type: string, x: number, target: EventTarget): void => {
    target.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: type === 'pointerup' ? 0 : 1,
            clientX: x,
            clientY: 50,
            pointerId: 1
        })
    )
}

/** 段内手柄（左缘 `.day-task-resize--start` / 右缘 `.day-task-resize`） */
const handleOf = (w: VueWrapper, taskId: string, side: 'start' | 'end'): HTMLElement => {
    const bar = w.find(`[data-task-id="${taskId}"]`)
    const seg = bar.element.parentElement!
    const selector = side === 'start' ? '.day-task-resize--start' : '.day-task-resize'
    return seg.querySelector(selector) as HTMLElement
}

const lastPatch = () => {
    const call = hoisted.update.mock.calls.at(-1)
    return call?.[1] as { startAt?: string | null; endAt?: string | null } | undefined
}

const hhmm = (value: string | null | undefined) => (value ? dayjs(value).format('HH:mm') : null)
const ymd = (value: string | null | undefined) => (value ? dayjs(value).format('YYYY-MM-DD') : null)

beforeEach(() => {
    hoisted.list.mockReset().mockResolvedValue([
        {
            taskIds: TASKS.map((task) => task.id),
            pagination: { total: TASKS.length, page: 1, limit: 100, maxPage: 1 }
        },
        null
    ])
    hoisted.update.mockReset().mockResolvedValue(null)
    hoisted.create.mockReset().mockResolvedValue([{ id: 'new' }, null])
    hoisted.open.mockReset()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('TASK-19B AC2 全天只读条（task-bar 复用，无手柄，原因分档）', () => {
    it('全天任务为 task-bar（.cal-item）、无 .day-allday-chip、无拉伸手柄', async () => {
        const w = await mountDaily()
        const lane = w.find('.day-allday-lane')
        expect(lane.exists()).toBe(true)
        expect(lane.findAll('.day-allday-chip')).toHaveLength(0)
        expect(lane.findAll('.cal-item')).toHaveLength(2)
        expect(lane.findAll('.day-task-resize')).toHaveLength(0)
        expect(lane.findAll('.day-task-resize--start')).toHaveLength(0)
    })

    it('结构契约（r5）：泳道与网格均为 .day-scroll 直接子节点且泳道在前（允许 <nue-divider />）', async () => {
        const w = await mountDaily()
        const scroll = w.find('.day-scroll')
        const lane = w.find('.day-allday-lane')
        const grid = w.find('.day-grid')
        expect(lane.element.parentElement).toBe(scroll.element)
        expect(grid.element.parentElement).toBe(scroll.element)
        const children = Array.from(scroll.element.children)
        expect(children.indexOf(lane.element)).toBeLessThan(children.indexOf(grid.element))
    })

    it('data-allday-reason ∈ {span-over-24h, end-only} 且两类互异；title 含任务名（r3）', async () => {
        const w = await mountDaily()
        const bars = w.findAll('.day-allday-lane .cal-item')
        expect(bars).toHaveLength(2)
        const reasons = bars.map((bar) => bar.attributes('data-allday-reason'))
        for (const reason of reasons) {
            expect(['span-over-24h', 'end-only'], String(reason)).toContain(reason)
        }
        expect(new Set(reasons).size).toBe(2)

        const byReason = new Map(bars.map((bar) => [bar.attributes('data-allday-reason'), bar]))
        // title = 任务名（原因文案）⇒ 必须包含任务名（不得覆盖）
        expect(byReason.get('end-only')?.attributes('title')).toContain('任务 ae')
        expect(byReason.get('span-over-24h')?.attributes('title')).toContain('任务 fs')
    })
})

describe('TASK-19B AC4 两侧手柄恒在（含续接段，无 isStart/isEnd 门控）', () => {
    it('每个段左右各一手柄；左缘手柄不占用右缘 .day-task-resize 类名（保护既有右拉用例）', async () => {
        const w = await mountDaily()
        // 3 个时间轴段（n / cs / ce），全天 2 条不入时间轴
        expect(w.findAll('.day-seg')).toHaveLength(3)
        expect(w.findAll('.day-task-resize')).toHaveLength(3)
        expect(w.findAll('.day-task-resize--start')).toHaveLength(3)
        // 左缘手柄不匹配 `.day-task-resize`（否则既有 `find` 会命中左缘）
        expect(handleOf(w, 'n', 'start').classList.contains('day-task-resize')).toBe(false)
        // 既有右拉用例依赖 `[data-testid="day-task-resize"]` 唯一指向右缘：每段恰好 1 个
        for (const seg of w.findAll('.day-seg')) {
            expect(seg.findAll('[data-testid="day-task-resize"]')).toHaveLength(1)
        }
    })

    it('续接段（isStart=false / isEnd=false）两侧手柄均存在', async () => {
        const w = await mountDaily()
        expect(handleOf(w, 'cs', 'start')).toBeTruthy()
        expect(handleOf(w, 'cs', 'end')).toBeTruthy()
        expect(handleOf(w, 'ce', 'start')).toBeTruthy()
        expect(handleOf(w, 'ce', 'end')).toBeTruthy()
    })

    it('左拉普通段 ⇒ 改 startAt、endAt 不变（时长改变）', async () => {
        const w = await mountDaily()
        const track = w.find('[data-testid="day-axis-track"]')
        stubRect(track.element, 0, 1440) // 1px = 1 分钟
        const handle = handleOf(w, 'n', 'start')

        pointer('pointerdown', 540, handle)
        await nextTick()
        pointer('pointermove', 480, window) // -60 分钟
        pointer('pointerup', 480, window)
        await flushPromises()

        const patch = lastPatch()
        expect(patch).toBeTruthy()
        expect(hhmm(patch!.startAt)).toBe('08:00')
        expect(hhmm(patch!.endAt)).toBe('10:00')
    })

    it('左拉续接段 ⇒ 锚真实 startAt（前一天）、不夹取到 00:00（C13 + D2）', async () => {
        const w = await mountDaily()
        const track = w.find('[data-testid="day-axis-track"]')
        stubRect(track.element, 0, 1440)
        const handle = handleOf(w, 'cs', 'start')

        pointer('pointerdown', 540, handle)
        await nextTick()
        pointer('pointermove', 480, window) // -60 分钟
        pointer('pointerup', 480, window)
        await flushPromises()

        const patch = lastPatch()
        expect(patch).toBeTruthy()
        // 真实 startAt = 前一天 22:00 ⇒ -60 ⇒ 前一天 21:00（不得夹到当天 00:00）
        expect(ymd(patch!.startAt)).toBe(YESTERDAY)
        expect(hhmm(patch!.startAt)).toBe('21:00')
        // endAt 保持真实值不变（今 02:00）
        expect(ymd(patch!.endAt)).toBe(TODAY)
        expect(hhmm(patch!.endAt)).toBe('02:00')
    })
})

describe('TASK-20 AC2 拖动反馈（浮层 / 源条区分 / 吸附起止预览 / 吸附高亮线）', () => {
    it('拖动中四项反馈可见；松手写回后消失', async () => {
        const w = await mountDaily()
        const track = w.find('[data-testid="day-axis-track"]')
        stubRect(track.element, 0, 1440) // 1px = 1 分钟
        const bar = w.find('[data-task-id="n"]')

        pointer('pointerdown', 540, bar.element)
        await nextTick()
        pointer('pointermove', 570, window) // +30 分钟
        await nextTick()

        // ① 跟随指针的浮层
        expect(w.find('.drag-ghost').exists()).toBe(true)
        // ② 源条视觉区分
        expect(w.find('[data-task-id="n"]').classes()).toContain('is-drag-source')
        // ③ 吸附后起止时刻预览（09:00–10:00 +30 ⇒ 09:30 → 10:30）
        const preview = w.find('[data-testid="day-drag-preview"]')
        expect(preview.exists()).toBe(true)
        expect(preview.text()).toContain('09:30')
        expect(preview.text()).toContain('10:30')
        // ④ 吸附刻度高亮线
        expect(w.find('[data-testid="day-drag-snap-line"]').exists()).toBe(true)

        pointer('pointerup', 570, window)
        await flushPromises()

        expect(w.find('.drag-ghost').exists()).toBe(false)
        expect(w.find('[data-testid="day-drag-preview"]').exists()).toBe(false)
        expect(w.find('[data-testid="day-drag-snap-line"]').exists()).toBe(false)
        expect(hhmm(lastPatch()?.startAt)).toBe('09:30')
    })

    it('非拖动状态不渲染预览 / 吸附线（负向）', async () => {
        const w = await mountDaily()
        expect(w.find('[data-testid="day-drag-preview"]').exists()).toBe(false)
        expect(w.find('[data-testid="day-drag-snap-line"]').exists()).toBe(false)
    })
})

describe('TASK-19B AC3 贴边名称 opt-in 与裁切遮罩（结构）', () => {
    it('日视图任务条带 is-sticky-label；月/周默认 task-bar 不带（opt-in 零变化）', async () => {
        const w = await mountDaily()
        expect(w.find('[data-testid="day-task"]').classes()).toContain('is-sticky-label')

        const plain = mount(TaskBar, {
            props: {
                task: TASKS[0]!,
                pos: { left: '0%', width: '14%', top: '0px' }
            },
            global: { plugins: [nueUI] }
        })
        expect(plain.find('.cal-item').classes()).not.toContain('is-sticky-label')
        plain.unmount()
    })

    it('.day-body-wrap 在滚动容器之外承载 .day-edge-fade.is-start/.is-end（r3 类名）', async () => {
        const w = await mountDaily()
        const wrap = w.find('.day-body-wrap')
        expect(wrap.exists()).toBe(true)
        expect(wrap.find('.day-body').exists()).toBe(true)
        const fades = wrap.findAll('.day-edge-fade')
        expect(fades).toHaveLength(2)
        expect(wrap.find('.day-edge-fade.is-start').exists()).toBe(true)
        expect(wrap.find('.day-edge-fade.is-end').exists()).toBe(true)
    })
})

describe('TASK-19B AC6 格线档位修饰类（四级嵌套链）', () => {
    it('×1/×1.5 ⇒ .day-col-lines--30；×2/×3 ⇒ --15；×4 ⇒ --5', async () => {
        const cases: { zoom: 1 | 1.5 | 2 | 3 | 4; modifier: string }[] = [
            { zoom: 1, modifier: 'day-col-lines--30' },
            { zoom: 1.5, modifier: 'day-col-lines--30' },
            { zoom: 2, modifier: 'day-col-lines--15' },
            { zoom: 3, modifier: 'day-col-lines--15' },
            { zoom: 4, modifier: 'day-col-lines--5' }
        ]
        for (const row of cases) {
            const w = await mountDaily(ref(row.zoom))
            const bg = w.find('[data-testid="day-axis-bg"]')
            expect(bg.classes(), `×${row.zoom}`).toContain(row.modifier)
            // 禁 列数×N 背景 DOM
            expect(bg.element.children.length).toBe(0)
            w.unmount()
            wrapper = null
        }
    })

    it('×4 列头子节点 === 288（性能硬断言，C8①/C6）', async () => {
        const w = await mountDaily(ref(4))
        const head = w.find('[data-testid="day-columns"]')
        expect(head.element.children).toHaveLength(288)
    })
})

describe('TASK-19B AC10 性能结构（段数/条数与档位无关）', () => {
    it('.cal-lanes 段数 === 当日段数（3）且不随档位变化；泳道条数 === 全天任务数（2）', async () => {
        for (const zoom of [1, 4] as const) {
            const w = await mountDaily(ref(zoom))
            expect(w.findAll('.cal-lanes .day-seg'), `×${zoom}`).toHaveLength(3)
            expect(w.findAll('.day-allday-lane .cal-item'), `×${zoom}`).toHaveLength(2)
            w.unmount()
            wrapper = null
        }
    })
})

describe('TASK-19B AC1 日视图不自建 payload（落点 = 宿主桥）', () => {
    it('daily/index.vue 源码不引用 TASK_CREATOR_DIALOG_KEY / dialogManager.open，且调用 onCreateTaskAt', () => {
        const sources = import.meta.glob('../index.vue', {
            query: '?raw',
            import: 'default',
            eager: true
        }) as Record<string, string>
        const source = Object.values(sources)[0] ?? ''
        expect(source.length).toBeGreaterThan(0)
        expect(source).not.toContain('TASK_CREATOR_DIALOG_KEY')
        expect(source).not.toContain('dialogManager.open')
        expect(source).toContain('onCreateTaskAt')
    })
})

// —— C11 `n` 快捷键：直接挂载宿主组合式（内部 viewMode 可切换），捕获 day 上下文 ——
const buildIndexContext = () => ({
    appDialogManager: { open: vi.fn() },
    appSubscriber: { subscribe: () => {}, unsubscribe: () => {}, emit: () => {} },
    isDisplayAside: ref(false),
    isUseFloatAside: ref(false),
    switchDisplayAside: () => {},
    asideWidth: ref('0px'),
    handleResizeAside: () => {},
    setControllOption: () => {},
    isDisplayOutline: ref(false),
    isUseFloatOutline: ref(false),
    showTaskDetails: () => {},
    getProjectName: () => '',
    getTagColor: () => ''
})

let viewModeRef: Ref<'month' | 'week' | 'day'> | null = null
let dayCtx: CalendarDayContext | null = null

const CaptureDay = defineComponent({
    setup() {
        dayCtx = inject(CALENDAR_DAY_CONTEXT_KEY, null) as CalendarDayContext | null
        return () => null
    }
})

const HostHarness = defineComponent({
    setup() {
        const host = useCalendarHost()
        viewModeRef = host.viewMode as Ref<'month' | 'week' | 'day'>
        return () => h(CaptureDay)
    }
})

const mountHost = async (): Promise<VueWrapper> => {
    const pinia = createPinia()
    setActivePinia(pinia)
    wrapper = mount(HostHarness, {
        attachTo: document.body,
        global: {
            plugins: [pinia],
            provide: {
                [CALENDAR_VIEW_CONTEXT_KEY as symbol]: buildContext(),
                [INDEX_VIEW_CONTEXT_KEY as symbol]: buildIndexContext()
            }
        }
    })
    await flushPromises()
    return wrapper
}

describe('TASK-19B C11 n 快捷键（复用 calendar.quick-create，viewMode 分支）', () => {
    it('命令存在、keys=n、scope=CALENDAR_KEY_SCOPE（不新增第二个 n 绑定）', async () => {
        await mountHost()
        const cmd = registry.get('calendar.quick-create')
        expect(cmd).toBeDefined()
        expect(cmd?.keyboard?.keys).toBe('n')
        expect(cmd?.keyboard?.scope).toBe(CALENDAR_KEY_SCOPE)
    })

    it('day 视图 + 非今天锚点 ⇒ 经宿主桥打开对话框，defaultStartMin = 540（09:00）', async () => {
        await mountHost()
        viewModeRef!.value = 'day'
        const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
        dayCtx!.anchorKey.value = yesterday
        await nextTick()

        registry.execute('calendar.quick-create')
        await flushPromises()

        expect(hoisted.open).toHaveBeenCalledTimes(1)
        const [key, payload] = hoisted.open.mock.calls[0] as [
            unknown,
            { startAt: string; endAt: string }
        ]
        expect(key).toBe(TASK_CREATOR_DIALOG_KEY)
        expect(ymd(payload.startAt)).toBe(yesterday)
        expect(hhmm(payload.startAt)).toBe('09:00')
        expect(hhmm(payload.endAt)).toBe('09:30')
    })

    it('day 视图 + 今天锚点 ⇒ defaultStartMin = ceil(now/30)*30（≤ 23:30）', async () => {
        await mountHost()
        viewModeRef!.value = 'day'
        dayCtx!.anchorKey.value = TODAY
        await nextTick()

        const nowMin = dayjs().hour() * 60 + dayjs().minute()
        const expected = Math.min(23 * 60 + 30, Math.ceil(nowMin / 30) * 30)

        registry.execute('calendar.quick-create')
        await flushPromises()

        expect(hoisted.open).toHaveBeenCalledTimes(1)
        const payload = hoisted.open.mock.calls[0]?.[1] as { startAt: string; endAt: string }
        const startMin = dayjs(payload.startAt).hour() * 60 + dayjs(payload.startAt).minute()
        // 容忍分钟跨界的极少数竞态：允许 next 30 分刻度
        expect([expected, Math.min(23 * 60 + 30, expected + 30)]).toContain(startMin)
        expect(startMin % 30).toBe(0)
        expect(dayjs(payload.endAt).diff(dayjs(payload.startAt), 'minute')).toBe(30)
    })

    it('month 视图触发 ⇒ 不打开对话框（行为零变化）', async () => {
        await mountHost()
        viewModeRef!.value = 'month'
        await nextTick()

        registry.execute('calendar.quick-create')
        await flushPromises()
        expect(hoisted.open).not.toHaveBeenCalled()
    })
})