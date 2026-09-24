// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import dayjs from 'dayjs'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '@nao-todo/presentation/task'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { DRAG_THRESHOLD_PX } from '../../monthly/use-drag-schedule'
import DailyView from '../index.vue'

/**
 * TASK-19B AC5 空白横向平移（pan）——交互契约 ADR C4
 *  - 阈值 = `DRAG_THRESHOLD_PX`（5px，单一来源）；仅横向；未超阈值不滚动。
 *  - 目标排除：`.cal-item` / `.day-seg` / `.day-task-resize` / `.day-cols-head` / `.day-allday-lane` 起拖不 pan。
 *  - pointerup / pointercancel 退出；`.is-panning` 类；pan 不触发任务列表重拉（AC8/AC10②）。
 *
 * 注：新增文件；不修改 `daily-interactions.test.ts`。
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
const YESTERDAY = dayjs().subtract(1, 'day').format('YYYY-MM-DD')

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
    taskOf({ id: 'cs', startAt: `${YESTERDAY} 22:00:00`, endAt: `${TODAY} 02:00:00` }),
    taskOf({ id: 'ae', startAt: null, endAt: `${TODAY} 10:00:00` })
]

const buildContext = () => ({
    dialogManager: { open: vi.fn() },
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

// —— TASK-20 源级断言辅助（jsdom 不应用 SFC CSS ⇒ 读原始样式文本） ——
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

let wrapper: VueWrapper | null = null

const mountDaily = async (): Promise<VueWrapper> => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useTasksStore().addTasks(TASKS)
    wrapper = mount(DailyView, {
        attachTo: document.body,
        global: {
            plugins: [pinia],
            provide: { [CALENDAR_VIEW_CONTEXT_KEY as symbol]: buildContext() }
        }
    })
    await flushPromises()
    return wrapper
}

const bodyOf = (w: VueWrapper): HTMLElement => w.find('.day-body').element as HTMLElement

const pointer = (type: string, x: number, target: EventTarget, y = 50): void => {
    target.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: type === 'pointerup' ? 0 : 1,
            clientX: x,
            clientY: y,
            pointerId: 1
        })
    )
}

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
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('TASK-19B AC5 空白横向 pan（阈值 / 方向 / 状态类）', () => {
    it('阈值常量单一来源 = 5px', () => {
        expect(DRAG_THRESHOLD_PX).toBe(5)
    })

    it('空白起拖超阈值 ⇒ scrollLeft 按 -(dx) 变化、纵向不变、.is-panning 出现并在 pointerup 退出', async () => {
        const w = await mountDaily()
        const body = bodyOf(w)
        body.scrollLeft = 100
        body.scrollTop = 7

        pointer('pointerdown', 200, body)
        await nextTick()
        pointer('pointermove', 140, body) // dx = -60
        await nextTick()
        expect(body.classList.contains('is-panning')).toBe(true)
        expect(body.scrollLeft).toBe(160)
        expect(body.scrollTop).toBe(7)

        pointer('pointerup', 140, body)
        await flushPromises()
        expect(body.classList.contains('is-panning')).toBe(false)
    })

    it('位移未超阈值 ⇒ 不滚动、不进入 panning', async () => {
        const w = await mountDaily()
        const body = bodyOf(w)
        body.scrollLeft = 100

        const dx = DRAG_THRESHOLD_PX - 1 // 4px < 5px
        pointer('pointerdown', 200, body)
        await nextTick()
        pointer('pointermove', 200 + dx, body)
        await nextTick()
        expect(body.scrollLeft).toBe(100)
        expect(body.classList.contains('is-panning')).toBe(false)
        pointer('pointerup', 200 + dx, body)
        await flushPromises()
    })

    it('pointercancel 退出 panning（不残留）', async () => {
        const w = await mountDaily()
        const body = bodyOf(w)
        body.scrollLeft = 0
        pointer('pointerdown', 200, body)
        await nextTick()
        pointer('pointermove', 150, body)
        await nextTick()
        expect(body.classList.contains('is-panning')).toBe(true)

        pointer('pointercancel', 150, body)
        await flushPromises()
        expect(body.classList.contains('is-panning')).toBe(false)
    })
})

describe('TASK-19B AC5 目标排除（零抢占）', () => {
    const cases: { name: string; pick: (w: VueWrapper) => Element }[] = [
        { name: '.cal-item 任务条', pick: (w) => w.find('[data-task-id="n"]').element },
        { name: '.day-seg 段', pick: (w) => w.find('.day-seg').element },
        {
            name: '.day-task-resize 右缘手柄',
            pick: (w) => w.find('[data-testid="day-task-resize"]').element
        },
        { name: '.day-cols-head 列头', pick: (w) => w.find('.day-cols-head').element },
        { name: '.day-allday-lane 全天泳道', pick: (w) => w.find('.day-allday-lane').element }
    ]

    for (const c of cases) {
        it(`从 ${c.name} 起拖 ⇒ 不触发 pan`, async () => {
            const w = await mountDaily()
            const body = bodyOf(w)
            body.scrollLeft = 100
            const target = c.pick(w)

            pointer('pointerdown', 200, target)
            await nextTick()
            pointer('pointermove', 120, body)
            await nextTick()
            expect(body.classList.contains('is-panning')).toBe(false)
            expect(body.scrollLeft).toBe(100)
            pointer('pointerup', 120, body)
            await flushPromises()
        })
    }
})

describe('TASK-20 AC5/AC6 pan 加固（自愈 / 兜底收尾 / touch-action / preventDefault）', () => {
    it('陈旧会话自愈：未收尾的 pan 后再次起拖仍生效（按新起点计算）', async () => {
        const w = await mountDaily()
        const body = bodyOf(w)
        body.scrollLeft = 100

        // 第一次会话：起拖 + 超阈值（不释放，模拟卡死）
        pointer('pointerdown', 200, body)
        await nextTick()
        pointer('pointermove', 140, body)
        await nextTick()
        expect(body.classList.contains('is-panning')).toBe(true)
        expect(body.scrollLeft).toBe(160)

        // 未 pointerup，直接第二次 pointerdown ⇒ 先释放陈旧会话，再按新起点工作
        pointer('pointerdown', 300, body)
        await nextTick()
        pointer('pointermove', 200, body) // dx = -100 ⇒ 160 + 100
        await nextTick()
        expect(body.classList.contains('is-panning')).toBe(true)
        expect(body.scrollLeft).toBe(260)

        pointer('pointerup', 200, body)
        await flushPromises()
        expect(body.classList.contains('is-panning')).toBe(false)
    })

    it('pointercancel 收尾后可立即再次 pan（会话不残留）', async () => {
        const w = await mountDaily()
        const body = bodyOf(w)
        body.scrollLeft = 50

        pointer('pointerdown', 200, body)
        await nextTick()
        pointer('pointermove', 150, body) // dx = -50 ⇒ 100
        await nextTick()
        expect(body.classList.contains('is-panning')).toBe(true)

        pointer('pointercancel', 150, body)
        await flushPromises()
        expect(body.classList.contains('is-panning')).toBe(false)

        pointer('pointerdown', 300, body)
        await nextTick()
        pointer('pointermove', 320, body) // dx = +20 ⇒ 100 - 20
        await nextTick()
        expect(body.classList.contains('is-panning')).toBe(true)
        expect(body.scrollLeft).toBe(80)

        pointer('pointerup', 320, body)
        await flushPromises()
    })

    it('pan 面声明 touch-action（触控不被原生手势抢占）', () => {
        const blocks = [
            cssRule(dailyStyle(), '.day-body'),
            cssRule(dailyStyle(), '.day-axis-track')
        ]
            .filter((block) => block !== '')
            .join('\n')
        expect(blocks).not.toBe('')
        expect(blocks).toMatch(/touch-action\s*:/)
    })

    it('pan 面 pointerdown preventDefault；排除目标上不拦截', async () => {
        const w = await mountDaily()
        const body = bodyOf(w)

        const blank = new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: 1,
            clientX: 200,
            clientY: 50,
            pointerId: 1
        })
        body.dispatchEvent(blank)
        expect(blank.defaultPrevented).toBe(true)

        const onTask = new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: 1,
            clientX: 200,
            clientY: 50,
            pointerId: 1
        })
        w.find('[data-task-id="n"]').element.dispatchEvent(onTask)
        expect(onTask.defaultPrevented).toBe(false)

        pointer('pointerup', 200, body)
        await flushPromises()
    })
})

describe('TASK-19B AC8/AC10② pan 不触发任务列表重拉', () => {
    it('pan 过程中 list 调用次数不变', async () => {
        const w = await mountDaily()
        const calls = hoisted.list.mock.calls.length
        const body = bodyOf(w)
        body.scrollLeft = 50
        pointer('pointerdown', 300, body)
        await nextTick()
        pointer('pointermove', 200, body)
        await nextTick()
        pointer('pointermove', 100, body)
        pointer('pointerup', 100, body)
        await flushPromises()
        expect(hoisted.list.mock.calls.length).toBe(calls)
    })
})