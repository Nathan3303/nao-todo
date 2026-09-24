// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, ref } from 'vue'
import dayjs from 'dayjs'
import { registry } from '@/commands/instance'
import { useKeyboardShortcuts } from '@/hooks'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import CalendarMonthly from '../index.vue'

/**
 * TASK-16 回归守卫：日视图 ←/→ 快捷键步长（T52 发现缺陷的基线）
 * @description
 *  - 日视图：←/→ 应移动锚点 **±1 天**（当前落 week 分支 → ±7 天，必红）；
 *  - 标签：`calendar.nav.prev/next` 应含「前一天」「后一天」（当前「上个月/上周」，必红）；
 *  - 回归：月视图仍 ±1 月、周视图仍 ±1 周（防修 day 时改坏）。
 *  手法：真实挂载 `monthly/index.vue`（注册 `calendar.*` 命令 + 激活 `calendar` scope）+
 *        `useKeyboardShortcuts` 引擎，派发真实 `keydown`。
 */

const hoisted = vi.hoisted(() => ({ list: vi.fn() }))

vi.mock('@/hooks', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/hooks')>()
    return {
        ...actual,
        useTaskUseCase: () => ({
            list: hoisted.list,
            update: vi.fn(async () => null),
            create: vi.fn(async () => [{ id: 'new' }, null])
        })
    }
})

// 专注徽标会拉取 pomodoro 记录（jsdom 无后端）：替换为无害返回值
vi.mock('../use-pomodoro-badge', async () => {
    const { ref } = await import('vue')
    return { usePomodoroBadge: () => ({ badgeLabel: ref<string | null>(null) }) }
})

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

const buildIndexContext = () => ({
    appDialogManager: { open: () => {} },
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

const Host = defineComponent({
    setup() {
        useKeyboardShortcuts()
        return () => h(CalendarMonthly)
    }
})

// nue-dropdown 未注册时不会渲染 `#trigger` 作用域插槽（月份标题在内）→ 用 stub 提供 trigger
const DropdownStub = defineComponent({
    name: 'NueDropdown',
    setup(_, { slots }) {
        return () => h('div', [slots.trigger?.({ trigger: () => {} }), slots.default?.()])
    }
})

let wrapper: VueWrapper | null = null

const mountMonthly = async (): Promise<VueWrapper> => {
    const pinia = createPinia()
    setActivePinia(pinia)
    wrapper = mount(Host, {
        attachTo: document.body,
        global: {
            plugins: [pinia],
            stubs: { 'nue-dropdown': DropdownStub, NueDropdown: DropdownStub },
            provide: {
                [CALENDAR_VIEW_CONTEXT_KEY as symbol]: buildContext(),
                [INDEX_VIEW_CONTEXT_KEY as symbol]: buildIndexContext()
            }
        }
    })
    await flushPromises()
    return wrapper
}

const press = async (key: string): Promise<void> => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    await flushPromises()
}

const toDayView = async (w: VueWrapper): Promise<void> => {
    await w.find('[title="切换日视图"]').trigger('click')
    await flushPromises()
}
const toWeekView = async (w: VueWrapper): Promise<void> => {
    await w.find('[title="切换周视图"]').trigger('click')
    await flushPromises()
}

const parseDay = (text: string): dayjs.Dayjs => {
    const m = text.match(/(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/)
    if (!m) throw new Error(`无法解析日标题：${text}`)
    return dayjs(`${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`)
}
const parseMonth = (text: string): dayjs.Dayjs => {
    const m = text.match(/(\d+)\s*年\s*(\d+)\s*月/)
    if (!m) throw new Error(`无法解析月标题：${text}`)
    return dayjs(`${m[1]}-${String(m[2]).padStart(2, '0')}-01`)
}
const dayTitle = (w: VueWrapper) => parseDay(w.find('.day-title').text())
const monthTitle = (w: VueWrapper) => parseMonth(w.find('.cal-title').text())

beforeEach(() => {
    hoisted.list
        .mockReset()
        .mockResolvedValue([
            { taskIds: [], pagination: { total: 0, page: 1, limit: 100, maxPage: 1 } },
            null
        ])
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('T61 日视图 ←/→ 步长（回归守卫，预期红）', () => {
    it('日视图 ArrowLeft ⇒ 锚点 -1 天（不得 -7 天）', async () => {
        const w = await mountMonthly()
        await toDayView(w)
        const before = dayTitle(w)

        await press('ArrowLeft')

        const after = dayTitle(w)
        expect(after.format('YYYY-MM-DD')).toBe(before.subtract(1, 'day').format('YYYY-MM-DD'))
        expect(after.format('YYYY-MM-DD')).not.toBe(before.subtract(7, 'day').format('YYYY-MM-DD'))
    })

    it('日视图 ArrowRight ⇒ 锚点 +1 天（不得 +7 天）', async () => {
        const w = await mountMonthly()
        await toDayView(w)
        const before = dayTitle(w)

        await press('ArrowRight')

        const after = dayTitle(w)
        expect(after.format('YYYY-MM-DD')).toBe(before.add(1, 'day').format('YYYY-MM-DD'))
        expect(after.format('YYYY-MM-DD')).not.toBe(before.add(7, 'day').format('YYYY-MM-DD'))
    })

    it('标签：nav.prev 含「前一天」、nav.next 含「后一天」', async () => {
        await mountMonthly()
        expect(registry.get('calendar.nav.prev')?.label).toContain('前一天')
        expect(registry.get('calendar.nav.next')?.label).toContain('后一天')
    })
})

describe('T61 月/周回归守卫（防修 day 时改坏）', () => {
    it('月视图 ArrowLeft/Right ⇒ 仍 ±1 月', async () => {
        const w = await mountMonthly()
        const before = monthTitle(w)

        await press('ArrowLeft')
        const prev = monthTitle(w)
        expect(prev.format('YYYY-MM')).toBe(before.subtract(1, 'month').format('YYYY-MM'))

        await press('ArrowRight')
        const back = monthTitle(w)
        expect(back.format('YYYY-MM')).toBe(before.format('YYYY-MM'))
    })

    it('周视图 ArrowLeft ⇒ 锚点仍 -7 天（周步长不变）', async () => {
        const w = await mountMonthly()
        await toDayView(w)
        const base = dayTitle(w)

        await toWeekView(w)
        await press('ArrowLeft')
        await toDayView(w)

        expect(dayTitle(w).format('YYYY-MM-DD')).toBe(base.subtract(7, 'day').format('YYYY-MM-DD'))
    })
})