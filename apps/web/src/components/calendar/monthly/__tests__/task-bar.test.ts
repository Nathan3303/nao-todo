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

const makeTask = (overrides: Partial<TaskViewObject> = {}): TaskViewObject =>
    ({
        id: 't1',
        name: '任务 A',
        state: 'todo',
        priority: 'low',
        startAt: '2026-10-05T09:00:00',
        endAt: '2026-10-05T18:00:00',
        createdAt: '2026-10-01T00:00:00',
        ...overrides
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

const mountBar = (
    busy = false,
    showTime = false,
    task: TaskViewObject = makeTask()
): VueWrapper => {
    wrapper = mount(TaskBar, {
        attachTo: document.body,
        props: {
            task,
            pos: { left: '0%', width: '14.28%', top: '0px' },
            busy,
            showTime
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

describe('CalendarTaskBar - TASK-18 末尾触发器改截止时间', () => {
    const timeTrigger = (w: VueWrapper): HTMLElement =>
        w.find('.cal-item-more--time').element as HTMLElement
    const iconTrigger = (w: VueWrapper): HTMLElement =>
        w.find('.cal-item-more:not(.cal-item-more--time)').element as HTMLElement

    it('有截止时刻（showTime + endAt 合法）→ 触发器显示 HH:mm（非 startAt），位于名称之后', () => {
        const w = mountBar(false, true)
        const item = w.find('.cal-item')
        expect(item.find('.cal-item-more--time').exists()).toBe(true)
        expect(timeTrigger(w).textContent?.trim()).toBe('18:00')
        expect(timeTrigger(w).textContent?.trim()).not.toBe('09:00')
        // 文档顺序：名称 → 时间触发器
        const ordered = [
            ...item.element.querySelectorAll('.cal-item-text, .cal-item-more--time')
        ].map((el) => el.className)
        expect(ordered).toEqual(['cal-item-text', 'cal-item-more cal-item-more--time'])
        // 时间形式不再渲染三点图标
        expect(item.find('.cal-item-more:not(.cal-item-more--time)').exists()).toBe(false)
    })

    it('点击时间触发器 → 打开改期下拉（功能不变），不开详情', async () => {
        const w = mountBar(false, true)
        timeTrigger(w).click()
        await nextTick()
        await nextTick()
        expect(isOpen()).toBe(true)
        expect(menuLabels()).toEqual(['今天', '明天', '下周同日', '选择日期…'])
        expect(w.emitted('open')).toBeUndefined()
    })

    it('showTime=false / 无合法 endAt → 回退 more-vertical 图标触发器', () => {
        const noShow = mountBar(false, false)
        expect(noShow.find('.cal-item-more--time').exists()).toBe(false)
        expect(iconTrigger(noShow)).toBeTruthy()
        wrapper?.unmount()

        const noEnd = mountBar(false, true, makeTask({ endAt: '' }))
        expect(noEnd.find('.cal-item-more--time').exists()).toBe(false)
        expect(iconTrigger(noEnd)).toBeTruthy()
        wrapper?.unmount()

        const badEnd = mountBar(false, true, makeTask({ endAt: 'not-a-date' }))
        expect(badEnd.find('.cal-item-more--time').exists()).toBe(false)
        expect(iconTrigger(badEnd)).toBeTruthy()
    })

    it('busy：时间触发器禁用（防连点）', () => {
        const w = mountBar(true, true)
        expect((timeTrigger(w) as HTMLButtonElement).disabled).toBe(true)
    })

    it('从时间触发器按下 → 不上抛 drag-pointer-down（拖拽跳过触发器）', async () => {
        const w = mountBar(false, true)
        timeTrigger(w).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
        await nextTick()
        expect(w.emitted('drag-pointer-down')).toBeUndefined()
    })
})