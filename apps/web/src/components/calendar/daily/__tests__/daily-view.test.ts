// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref, type Ref } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '@nao-todo/presentation/task'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import DailyView from '../index.vue'
import { dayScrollWidthCss } from '../day-zoom'

/**
 * TASK-16 日视图组件 DOM 契约（PRD §5.7 冻结 / C6 / C12）
 * @description
 *  - `[data-testid="day-columns"]`：×1 时子节点 48、其中有文本者 24（整点 24 个）；
 *    其余档位按 ADR §3-D1 矩阵（×2=96/48、×4=288/48，R2 起 ×4=5min）；
 *  - `[data-testid="day-axis-bg"]`：其内 `[data-col]` 数量必须为 0（禁 48×N 背景 DOM）；
 *  - `[data-testid="day-unscheduled-entry"]`：日视图自建未安排入口（C12）。
 *  - TASK-19：`.day-scroll` 承载宽高（`.day-cols-head` 与全天泳道同处其中，泳道在 `.day-grid` 之上）。
 *  注：组件挂载依赖的 props/context 若与实现不一致，mount 可能先失败；断言目标以 testid/ADR 类名为准。
 */

const buildContext = (dayZoom?: Ref<number>) => ({
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
    ...(dayZoom ? { dayZoom } : {})
})

const mountDaily = (dayZoom?: Ref<number>, tasks: TaskViewObject[] = []) => {
    const pinia = createPinia()
    setActivePinia(pinia)
    if (tasks.length > 0) useTasksStore().addTasks(tasks)
    return mount(DailyView, {
        global: {
            plugins: [pinia],
            provide: { [CALENDAR_VIEW_CONTEXT_KEY as symbol]: buildContext(dayZoom) }
        }
    })
}

// jsdom 会归一化 CSS 函数（`max(calc(1 * 100%), calc(48 * 20px))` → `max(100%, 960px)`），
// 故用同一归一器比较，确保组件确实应用了 `dayScrollWidthCss` 的返回值。
const normalizeWidth = (css: string): string => {
    const el = document.createElement('div')
    el.style.width = css
    return el.style.width
}

describe('TASK-16 日视图 DOM 契约（C6 / C12）', () => {
    it('列头容器 48 个子节点、其中 24 个有文本（整点）', () => {
        const wrapper = mountDaily()
        const container = wrapper.find('[data-testid="day-columns"]')
        expect(container.exists()).toBe(true)
        const children = Array.from(container.element.children)
        expect(children).toHaveLength(48)
        const withText = children.filter((el) => (el.textContent ?? '').trim().length > 0)
        expect(withText).toHaveLength(24)
        wrapper.unmount()
    })

    it('时间轴背景不含任何 [data-col] 节点（禁 48×N DOM）', () => {
        const wrapper = mountDaily()
        const bg = wrapper.find('[data-testid="day-axis-bg"]')
        expect(bg.exists()).toBe(true)
        expect(bg.findAll('[data-col]')).toHaveLength(0)
        wrapper.unmount()
    })

    it('日视图头部存在未安排入口（C12）', () => {
        const wrapper = mountDaily()
        expect(wrapper.find('[data-testid="day-unscheduled-entry"]').exists()).toBe(true)
        wrapper.unmount()
    })
})

describe('TASK-19 档位矩阵列头（D1.1 / C6 / AC2）', () => {
    const MATRIX = [
        { zoom: 1, columns: 48, labels: 24 },
        { zoom: 1.5, columns: 48, labels: 24 },
        { zoom: 2, columns: 96, labels: 48 },
        { zoom: 3, columns: 96, labels: 48 },
        { zoom: 4, columns: 288, labels: 48 }
    ] as const

    for (const row of MATRIX) {
        it(`×${row.zoom} ⇒ 列头 ${row.columns} 子节点 / ${row.labels} 有文本 / grid repeat(${row.columns}, 1fr)`, () => {
            const wrapper = mountDaily(ref(row.zoom))
            const container = wrapper.find('[data-testid="day-columns"]')
            expect(container.exists()).toBe(true)
            const children = Array.from(container.element.children)
            expect(children).toHaveLength(row.columns)
            const withText = children.filter((el) => (el.textContent ?? '').trim().length > 0)
            expect(withText).toHaveLength(row.labels)
            expect((container.element as HTMLElement).style.gridTemplateColumns).toBe(
                `repeat(${row.columns}, 1fr)`
            )
            wrapper.unmount()
        })
    }
})

describe('TASK-19 滚动容器与全天泳道（D5 / AC4）', () => {
    it('.day-scroll 宽度样式 = dayScrollWidthCss(1, 48)（×1 默认）', () => {
        const wrapper = mountDaily()
        const scroll = wrapper.find('.day-scroll')
        expect(scroll.exists()).toBe(true)
        expect((scroll.element as HTMLElement).style.width).toBe(
            normalizeWidth(dayScrollWidthCss(1, 48))
        )
        wrapper.unmount()
    })

    it('×2 ⇒ .day-scroll 宽度样式 = dayScrollWidthCss(2, 96)', () => {
        const wrapper = mountDaily(ref(2))
        const scroll = wrapper.find('.day-scroll')
        expect(scroll.exists()).toBe(true)
        expect((scroll.element as HTMLElement).style.width).toBe(
            normalizeWidth(dayScrollWidthCss(2, 96))
        )
        wrapper.unmount()
    })

    it('.day-cols-head 与全天泳道同处 .day-scroll 内；泳道为 .day-grid 之上的兄弟块', () => {
        const wrapper = mountDaily()
        const scroll = wrapper.find('.day-scroll')
        const head = wrapper.find('.day-cols-head')
        const allday = wrapper.find('.day-allday-lane')
        const grid = wrapper.find('.day-grid')
        expect(scroll.exists()).toBe(true)
        expect(head.exists()).toBe(true)
        expect(allday.exists()).toBe(true)
        expect(grid.exists()).toBe(true)
        // 同一横向滚动源
        expect(scroll.element.contains(head.element)).toBe(true)
        expect(scroll.element.contains(allday.element)).toBe(true)
        expect(scroll.element.contains(grid.element)).toBe(true)
        // 泳道不是 .day-grid 子节点，且位于其之前（时间轴区顶部）
        expect(grid.element.contains(allday.element)).toBe(false)
        expect(allday.element.nextElementSibling).toBe(grid.element)
        wrapper.unmount()
    })

    it('不再渲染时间轴上方独立全天行（.day-body 直接子节点不含列头/全天行）', () => {
        const wrapper = mountDaily()
        const body = wrapper.find('.day-body')
        expect(body.exists()).toBe(true)
        const direct = Array.from(body.element.children)
        expect(direct.some((el) => el.classList.contains('day-cols-head'))).toBe(false)
        expect(direct.some((el) => el.classList.contains('day-allday-lane'))).toBe(false)
        expect(direct.some((el) => el.classList.contains('day-allday'))).toBe(false)
        wrapper.unmount()
    })

    it('全天任务渲染为 task-bar（.cal-item），不再有 .day-allday-chip（契约变更 B）', () => {
        const allDayTask = {
            id: 'ad',
            name: '全天任务',
            state: 'todo',
            priority: 'low',
            startAt: null,
            endAt: '2026-09-22 10:00:00',
            createdAt: '2026-09-01 00:00:00',
            tags: []
        } as unknown as TaskViewObject
        const wrapper = mountDaily(undefined, [allDayTask])
        const lane = wrapper.find('.day-allday-lane')
        expect(lane.exists()).toBe(true)
        expect(lane.findAll('.day-allday-chip')).toHaveLength(0)
        expect(lane.findAll('.cal-item').length).toBeGreaterThanOrEqual(1)
        // 结构契约保持
        expect(lane.element.nextElementSibling).toBe(wrapper.find('.day-grid').element)
        wrapper.unmount()
    })
})