// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'
import UnscheduledDrawer from '../unscheduled-drawer.vue'
import { todayDateKey } from '../monthly-layout'
import type { BatchScheduleResult } from '../reschedule'
import { nueUI } from '@/nue-ui-register'

/**
 * 抽屉单行「安排到…」B7 恢复断言（TASK-10：按钮为 reschedule-menu 的 NueDropdown 触发器）
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
            onScheduleToDay: (opts.onSchedule ?? vi.fn()) as unknown as (
                task: TaskViewObject,
                dateKey: string
            ) => void | Promise<void>,
            onBatchScheduleToDay: noopBatch,
            onOpenTask: vi.fn(),
            onClearFilter: vi.fn(),
            onShowCompleted: vi.fn()
        },
        global: {
            plugins: [createPinia(), nueUI],
            stubs: {
                'nue-div': slotStub,
                'nue-text': slotStub,
                'nue-drawer': drawerStub
            }
        }
    })
    return wrapper
}

const rowActionBtn = (): HTMLButtonElement | undefined => {
    const el = document.body.querySelector<HTMLButtonElement>('.us-actions .nue-button')
    return el ?? undefined
}
const isOpen = (): boolean =>
    !!document.body.querySelector('.nue-dropdown-wrapper[data-visible="true"]')
const menuItem = (label: string): HTMLElement | undefined =>
    [...document.body.querySelectorAll<HTMLElement>('.rmenu [role="menuitem"]')].find(
        (b) => b.textContent?.trim() === label
    )
const openRowMenu = async (): Promise<void> => {
    rowActionBtn()!.click()
    await nextTick()
    await nextTick()
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
        await openRowMenu()
        expect(isOpen()).toBe(true)
        const labels = [
            ...document.body.querySelectorAll<HTMLElement>('.rmenu [role="menuitem"]')
        ].map((b) => b.textContent?.trim())
        expect(labels).toEqual(['今天', '明天', '选择日期…'])
        menuItem('今天')!.click()
        await nextTick()
        expect(onSchedule).toHaveBeenCalledTimes(1)
        expect(onSchedule.mock.calls[0]![0]!.id).toBe('t-done')
        expect(onSchedule.mock.calls[0]![1]).toBe(todayDateKey())
        expect(w.emitted('update:open')).toBeUndefined()
        expect(isOpen()).toBe(false)
    })

    it('再次点击「安排到…」= 收起（触发器 toggle；S23 回归）', async () => {
        mountDrawer({ task: makeTask() })
        await openRowMenu()
        expect(isOpen()).toBe(true)
        rowActionBtn()!.click()
        await nextTick()
        expect(isOpen()).toBe(false)
    })

    it('busy（busyTaskId=该任务）→「安排到…」禁用，不可开（防连点）', async () => {
        mountDrawer({ task: makeTask(), busyTaskId: 't1' })
        const btn = rowActionBtn()!
        expect(btn.disabled).toBe(true)
        btn.click()
        await nextTick()
        expect(isOpen()).toBe(false)
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

describe('CalendarUnscheduledDrawer - F1 行拖源上抛', () => {
    const mountWithDrag = (overrides: { task?: TaskViewObject; multi?: boolean } = {}) => {
        const onRowDragStart = vi.fn()
        const w = mount(UnscheduledDrawer, {
            attachTo: document.body,
            props: {
                open: true,
                tasks: [overrides.task ?? makeTask()],
                filterActive: false,
                hideCompleted: false,
                scheduleBusy: false,
                busyTaskId: '',
                onToggleDone: vi.fn(),
                onScheduleToDay: vi.fn() as unknown as (
                    task: TaskViewObject,
                    dateKey: string
                ) => void | Promise<void>,
                onBatchScheduleToDay: noopBatch,
                onOpenTask: vi.fn() as unknown as (taskId: TaskViewObject['id']) => void,
                onClearFilter: vi.fn() as unknown as () => void,
                onShowCompleted: vi.fn() as unknown as () => void,
                onRowDragStart: onRowDragStart as unknown as (
                    task: TaskViewObject,
                    event: PointerEvent
                ) => void
            },
            global: {
                plugins: [createPinia(), nueUI],
                stubs: {
                    'nue-div': slotStub,
                    'nue-text': slotStub,
                    'nue-drawer': drawerStub
                }
            }
        })
        return { w, onRowDragStart }
    }

    const pointerDownOn = (target: Element, x = 10, y = 10): void => {
        target.dispatchEvent(
            new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: y })
        )
    }

    it('普通模式行主体按下 → 上抛 onRowDragStart（F1-01 拖源；阈值消歧在父级）', () => {
        const { onRowDragStart } = mountWithDrag()
        const main = document.body.querySelector<HTMLElement>('.us-item__row .us-main')!
        pointerDownOn(main)
        expect(onRowDragStart).toHaveBeenCalledTimes(1)
        const [task, event] = onRowDragStart.mock.calls[0]! as [TaskViewObject, PointerEvent]
        expect(task.id).toBe('t1')
        expect(event.clientX).toBe(10)
    })

    it('行内交互控件（「安排到…」按钮）按下不视为拖源', () => {
        const { onRowDragStart } = mountWithDrag()
        const actionBtn = document.body.querySelector<HTMLElement>('.us-actions .nue-button')!
        pointerDownOn(actionBtn)
        expect(onRowDragStart).not.toHaveBeenCalled()
    })
})