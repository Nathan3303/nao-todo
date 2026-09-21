// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { ref } from 'vue'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import DailyView from '../index.vue'

/**
 * TASK-16 日视图组件 DOM 契约（PRD §5.7 冻结 / C6 / C12）
 * @description
 *  - `[data-testid="day-columns"]`：子节点 48、其中有文本者 24（整点 24 个）；
 *  - `[data-testid="day-axis-bg"]`：其内 `[data-col]` 数量必须为 0（禁 48×N 背景 DOM）；
 *  - `[data-testid="day-unscheduled-entry"]`：日视图自建未安排入口（C12）。
 *  注：组件挂载依赖的 props/context 若与 T50 实现不一致，mount 可能先失败；断言目标以 testid 为准。
 */

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

const mountDaily = () =>
    mount(DailyView, {
        global: {
            plugins: [createPinia()],
            provide: { [CALENDAR_VIEW_CONTEXT_KEY as symbol]: buildContext() }
        }
    })

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