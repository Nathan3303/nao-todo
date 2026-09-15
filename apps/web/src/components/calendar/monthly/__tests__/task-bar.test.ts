// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { TaskViewObject } from '@nao-todo/domain-task'
import TaskBar from '../task-bar.vue'
import { todayDateKey } from '../monthly-layout'
import { nueUI } from '@/nue-ui-register'

/**
 * 任务条 F4 入口组件级断言（TASK-10）
 * @description 右键菜单已移除：右键仅阻止原生菜单、无响应（不再开菜单、不开详情）；
 *              悬停三点 = reschedule-menu（NueDropdown）触发器；busy 防连点（三点禁用）。
 */

const makeTask = (): TaskViewObject =>
    ({
        id: 't1',
        name: '任务 A',
        state: 'todo',
        priority: 'low',
        startAt: '2026-10-05T09:00:00',
        endAt: '2026-10-05T18:00:00',
        createdAt: '2026-10-01T00:00:00'
    }) as unknown as TaskViewObject

const isOpen = (): boolean =>
    !!document.body.querySelector('.nue-dropdown-wrapper[data-visible="true"]')
const menuLabels = (): (string | undefined)[] =>
    [...document.body.querySelectorAll<HTMLElement>('.rmenu [role="menuitem"]')].map((b) =>
        b.textContent?.trim()
    )
const itemButton = (label: string): HTMLElement | undefined =>
    [...document.body.querySelectorAll<HTMLElement>('.rmenu [role="menuitem"]')].find(
        (b) => b.textContent?.trim() === label
    )

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const mountBar = (busy = false): VueWrapper => {
    wrapper = mount(TaskBar, {
        attachTo: document.body,
        props: {
            task: makeTask(),
            pos: { left: '0%', width: '14.28%', top: '0px' },
            busy
        },
        global: { plugins: [nueUI] }
    })
    return wrapper
}

const barEl = (): HTMLElement => wrapper!.find('.cal-item').element as HTMLElement
const moreBtn = (): HTMLButtonElement =>
    wrapper!.find('.cal-item-more').element as HTMLButtonElement

const fireContextMenu = (el: HTMLElement, x = 120, y = 140): MouseEvent => {
    const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
    })
    el.dispatchEvent(event)
    return event
}

const openMenu = async (): Promise<void> => {
    moreBtn().click()
    await nextTick()
    await nextTick()
}

describe('CalendarTaskBar - F4 快速改期入口（TASK-10：右键移除 + 三点 NueDropdown）', () => {
    it('右键：阻止原生菜单（preventDefault）且无响应——不开菜单、不开详情（A1-F4-01 修订）', async () => {
        const w = mountBar()
        const event = fireContextMenu(barEl())
        await nextTick()
        expect(event.defaultPrevented).toBe(true)
        expect(isOpen()).toBe(false)
        expect(w.emitted('open')).toBeUndefined()
        expect(w.emitted('reschedule')).toBeUndefined()
    })

    it('三点按钮 → 打开四项菜单（今天/明天/下周同日/选择日期…），不开详情（A1-F4-02）', async () => {
        const w = mountBar()
        await openMenu()
        expect(isOpen()).toBe(true)
        expect(menuLabels()).toEqual(['今天', '明天', '下周同日', '选择日期…'])
        expect(w.emitted('open')).toBeUndefined()
    })

    it('菜单首项「今天」→ reschedule 今日键；随后菜单收起', async () => {
        const w = mountBar()
        await openMenu()
        itemButton('今天')!.click()
        await nextTick()
        expect(w.emitted('reschedule')?.[0]).toEqual([todayDateKey()])
        expect(isOpen()).toBe(false)
    })

    it('Esc 关闭菜单且无命令（A1-F4-11）', async () => {
        const w = mountBar()
        await openMenu()
        expect(isOpen()).toBe(true)
        document.body
            .querySelector<HTMLElement>('.nue-dropdown-overlay')!
            .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        await nextTick()
        expect(isOpen()).toBe(false)
        expect(w.emitted('reschedule')).toBeUndefined()
        expect(w.emitted('open')).toBeUndefined()
    })

    it('再次点击三点 = 收起（触发器 toggle；S23 同源口径）', async () => {
        const w = mountBar()
        await openMenu()
        expect(isOpen()).toBe(true)
        moreBtn().click()
        await nextTick()
        expect(isOpen()).toBe(false)
        expect(w.emitted('open')).toBeUndefined()
        expect(w.emitted('reschedule')).toBeUndefined()
    })

    it('busy：三点禁用、右键不弹菜单（防连点；A1-F4-13）', async () => {
        const w = mountBar(true)
        expect(moreBtn().disabled).toBe(true)
        fireContextMenu(barEl())
        await nextTick()
        expect(isOpen()).toBe(false)
        expect(w.emitted('reschedule')).toBeUndefined()
    })
})