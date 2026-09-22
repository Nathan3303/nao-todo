// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { useKeyboardShortcuts } from '@/hooks'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import CalendarHost from '../host.vue'

/**
 * TASK-18 / T71 AC6 零重拉（新增用例，另起文件）
 * @description 真实挂载 `host.vue`（状态宿主）+ 内存路由；切子路由时宿主不卸载 ⇒
 *              `useCalendarTaskQuery` 不重建、`list` 不重发（禁 keep-alive 兜底）。
 */

const hoisted = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn(), create: vi.fn() }))

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

const MonthView = defineComponent({
    name: 'MonthView',
    render: () => h('div', { class: 'v-month' })
})
const WeekView = defineComponent({ name: 'WeekView', render: () => h('div', { class: 'v-week' }) })
const DayView = defineComponent({ name: 'DayView', render: () => h('div', { class: 'v-day' }) })

const buildRouter = () => {
    const routes: RouteRecordRaw[] = [
        {
            path: '/calendar',
            name: 'calendar',
            component: { template: '<div><router-view /></div>' },
            children: [
                { path: 'monthly/:taskId?', name: 'calendar-monthly', component: MonthView },
                { path: 'weekly/:taskId?', name: 'calendar-weekly', component: WeekView },
                { path: 'daily/:taskId?', name: 'calendar-day', component: DayView }
            ]
        }
    ]
    return createRouter({ history: createMemoryHistory(), routes })
}

const HostWrapper = defineComponent({
    setup() {
        useKeyboardShortcuts()
        return () => h(CalendarHost)
    }
})

let wrapper: VueWrapper | null = null

beforeEach(() => {
    localStorage.clear()
    hoisted.list
        .mockReset()
        .mockResolvedValue([
            { taskIds: [], pagination: { total: 0, page: 1, limit: 100, maxPage: 1 } },
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

describe('T71 AC6 切视图零重拉（宿主不卸载）', () => {
    it('月→周→日：list 仅挂载时调用一次，且视图组件确实切换', async () => {
        const pinia = createPinia()
        setActivePinia(pinia)
        const router = buildRouter()
        await router.push('/calendar/monthly')
        await router.isReady()

        wrapper = mount(HostWrapper, {
            global: {
                plugins: [pinia, router],
                provide: {
                    [CALENDAR_VIEW_CONTEXT_KEY as symbol]: buildContext(),
                    [INDEX_VIEW_CONTEXT_KEY as symbol]: buildIndexContext()
                }
            }
        })
        await flushPromises()

        expect(hoisted.list).toHaveBeenCalledTimes(1)
        expect(wrapper.find('.v-month').exists()).toBe(true)

        await router.push({ name: 'calendar-weekly' })
        await flushPromises()
        expect(wrapper.find('.v-week').exists()).toBe(true)
        expect(hoisted.list).toHaveBeenCalledTimes(1)

        await router.push({ name: 'calendar-day', params: { taskId: 't-1' } })
        await flushPromises()
        expect(wrapper.find('.v-day').exists()).toBe(true)
        expect(hoisted.list).toHaveBeenCalledTimes(1)

        // 回到月视图仍不重拉
        await router.push({ name: 'calendar-monthly' })
        await flushPromises()
        expect(hoisted.list).toHaveBeenCalledTimes(1)
    })
})