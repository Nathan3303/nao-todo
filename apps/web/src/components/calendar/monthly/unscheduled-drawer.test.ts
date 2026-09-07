// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import { NueButton, NueDatePicker } from 'nue-ui'
import type { TaskViewObject } from '@nao-todo/domain-task'
import UnscheduledDrawer from './unscheduled-drawer.vue'
import { todayDateKey } from './monthly-layout'
import type { BatchScheduleResult } from './reschedule'

/**
 * 抽屉单行「安排到…」B7 恢复断言（PM M2 小补丁）
 * @description done 行（无 endAt）单行可安排：菜单可开、首位「今天」上抛（F4-08/09 done 链路）；
 *              禁用仅随 busy；多选态 done 置灰不可选守卫不放松（F3-02/14）。
 */

const slotStub = { template: '<div class="stub"><slot /></div>' }
const drawerStub = {
    template:
        '<div class="drawer-stub"><slot name="header" :close="() => {}" /><slot /><slot name="footer" /></div>'
}

const makeTask = (overrides: Partial<TaskViewObject> = {}): TaskViewObject =>
    ({
        id: 't1',
        name: '任务 A',
        state: 'todo',
        priority: 'low',
        startAt: null,
        endAt: '',
        projectId: '',
        tags: [],
        createdAt: '2026-10-01T00:00:00',
        ...overrides
    }) as unknown as TaskViewObject

const noopBatch = async (): Promise<BatchScheduleResult> => ({ ok: 0, fail: 0, failedIds: [] })

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const mountDrawer = (opts: {
    task: TaskViewObject
    busyTaskId?: string
    onSchedule?: ReturnType<typeof vi.fn>
}): VueWrapper => {
    wrapper = mount(UnscheduledDrawer, {
        attachTo: document.body,
        props: {
            open: true,
            tasks: [opts.task],
            filterActive: false,
            hideCompleted: false,
            scheduleBusy: false,
            busyTaskId: opts.busyTaskId ?? '',
            onToggleDone: vi.fn(),
            onScheduleToDay: opts.onSchedule ?? vi.fn(),
            onBatchScheduleToDay: noopBatch,
            onOpenTask: vi.fn(),
            onClearFilter: vi.fn(),
            onShowCompleted: vi.fn()
        },
        global: {
            plugins: [createPinia()],
            components: { 'nue-button': NueButton },
            stubs: {
                'nue-div': slotStub,
                'nue-text': slotStub,
                'nue-drawer': drawerStub,
                'nue-date-picker': NueDatePicker
            }
        }
    })
    return wrapper
}

const rowActionBtn = (): HTMLButtonElement | undefined => {
    const el = document.body.querySelector<HTMLButtonElement>('.us-actions .nue-button')
    return el ?? undefined
}
const menuItem = (label: string): HTMLElement | undefined => {
    const el = [...document.body.querySelectorAll<HTMLElement>('.rmenu [role="menuitem"]')].find(
        (b) => b.textContent?.trim() === label
    )
    return el
}

describe('CalendarUnscheduledDrawer - 单行「安排到…」B7 语义（done 可安排）', () => {
    it('done 行普通模式：「安排到…」可开菜单（三项）→ 首位「今天」上抛单行安排（F4-08/09 done 链路）', async () => {
        const onSchedule = vi.fn()
        const w = mountDrawer({
            task: makeTask({ state: 'done', id: 't-done' }),
            onSchedule
        })
        // done 行按钮不禁用（disabled 仅随 busy）
        const btn = rowActionBtn()!
        expect(btn.disabled).toBe(false)
        btn.click()
        await nextTick()
        const labels = [
            ...document.body.querySelectorAll<HTMLElement>('.rmenu [role="menuitem"]')
        ].map((b) => b.textContent?.trim())
        expect(labels).toEqual(['今天', '明天', '选择日期…'])
        menuItem('今天')!.click()
        expect(onSchedule).toHaveBeenCalledTimes(1)
        expect(onSchedule.mock.calls[0]![0]!.id).toBe('t-done')
        expect(onSchedule.mock.calls[0]![1]).toBe(todayDateKey())
        expect(w.emitted('update:open')).toBeUndefined()
    })

    it('busy（busyTaskId=该任务）→「安排到…」禁用，右键路径不可开（防连点）', async () => {
        mountDrawer({ task: makeTask(), busyTaskId: 't1' })
        const btn = rowActionBtn()!
        expect(btn.disabled).toBe(true)
        btn.click()
        await nextTick()
        expect(document.body.querySelector('.rmenu')).toBeNull()
    })

    it('多选态 done 行守卫不放松：置灰不可选、不进入选择（F3-02/14 无回归）', async () => {
        const onSchedule = vi.fn()
        mountDrawer({
            task: makeTask({ state: 'done', id: 't-done' }),
            onSchedule
        })
        // 开头部「多选」
        const toggle = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(
            (b) => b.textContent?.trim() === '多选'
        )!
        toggle.click()
        await nextTick()
        // 多选态：行内安排按钮隐藏
        expect(rowActionBtn()).toBeUndefined()
        // done 行选择勾置灰
        const box = document.body.querySelector<HTMLButtonElement>('.us-select-box')!
        expect(box.disabled).toBe(true)
        expect(box.getAttribute('aria-pressed')).toBe('false')
        // 行主体点击不产生选择变化/不开详情（无完成切换副作用）
        const row = document.body.querySelector<HTMLElement>('.us-item__row')!
        row.click()
        await nextTick()
        expect(onSchedule).not.toHaveBeenCalled()
    })
})