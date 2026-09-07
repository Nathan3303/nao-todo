// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { NueButton, NueDatePicker, NueDivider } from 'nue-ui'
import type { TaskViewObject } from '@nao-todo/domain-task'
import TaskBar from './task-bar.vue'
import { todayDateKey } from './monthly-layout'

/**
 * 任务条 F4 入口组件级断言（P3-2 / A1-F4-01/02/12）
 * @description 右键 contextmenu 与悬停三点打开同一菜单（同一命令），不开详情、无原生菜单
 *              （preventDefault）；busy 防连点（右键不弹、三点禁用）。
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

const menuLabels = (): (string | undefined)[] =>
    [...document.body.querySelectorAll<HTMLElement>('.rmenu [role="menuitem"]')].map((b) =>
        b.textContent?.trim()
    )

const itemButton = (label: string): HTMLElement | null | undefined =>
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
        global: {
            components: {
                'nue-button': NueButton,
                'nue-date-picker': NueDatePicker,
                'nue-divider': NueDivider
            }
        }
    })
    return wrapper
}

const barEl = (): HTMLElement => wrapper!.find('.cal-item').element as HTMLElement
const moreBtn = (): HTMLButtonElement =>
    wrapper!.find('.cal-item-more').element as HTMLButtonElement

const fireContextMenu = (el: HTMLElement, x = 120, y = 140): void => {
    el.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y })
    )
}

describe('CalendarTaskBar - F4 快速改期入口', () => {
    it('右键 → 打开四项菜单（今天/明天/下周同日/选择日期…），不开详情（A1-F4-01）', async () => {
        const w = mountBar()
        fireContextMenu(barEl())
        await nextTick()
        expect(menuLabels()).toEqual(['今天', '明天', '下周同日', '选择日期…'])
        expect(w.emitted('open')).toBeUndefined()
        expect(w.emitted('reschedule')).toBeUndefined()
    })

    it('三点按钮 → 同一菜单（与右键同一命令；A1-F4-02）', async () => {
        const w = mountBar()
        moreBtn().click()
        await nextTick()
        expect(menuLabels()).toEqual(['今天', '明天', '下周同日', '选择日期…'])
        expect(w.emitted('open')).toBeUndefined()
    })

    it('菜单首项「今天」→ reschedule 今日键；随后菜单收起', async () => {
        const w = mountBar()
        moreBtn().click()
        await nextTick()
        itemButton('今天')!.click()
        await nextTick()
        expect(w.emitted('reschedule')?.[0]).toEqual([todayDateKey()])
        expect(document.body.querySelector('.rmenu')).toBeNull()
    })

    it('Esc 关闭菜单且无命令（A1-F4-11）', async () => {
        const w = mountBar()
        moreBtn().click()
        await nextTick()
        expect(document.body.querySelector('.rmenu')).toBeTruthy()
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        await nextTick()
        expect(document.body.querySelector('.rmenu')).toBeNull()
        expect(w.emitted('reschedule')).toBeUndefined()
        expect(w.emitted('open')).toBeUndefined()
    })

    it('busy：右键不弹菜单、三点禁用（防连点；A1-F4-13）', async () => {
        const w = mountBar(true)
        expect(moreBtn().disabled).toBe(true)
        fireContextMenu(barEl())
        await nextTick()
        expect(document.body.querySelector('.rmenu')).toBeNull()
        expect(w.emitted('reschedule')).toBeUndefined()
    })
})