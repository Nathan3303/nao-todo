// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { h, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import RescheduleMenu from '../reschedule-menu.vue'
import { todayDateKey } from '../monthly-layout'
import { nueUI } from '@/nue-ui-register'

/**
 * F4 快速改期菜单组件级断言（TASK-10：NueDropdown 承载）
 * @description 菜单项集合与「下周同日」裁剪、今天命中、busy 防连点、开关（触发器 toggle /
 *              Esc / 外点）与 close 上抛。开合检测改用 NueDropdown 容器 data-visible。
 */

/** 弹层是否展开（NueDropdown 容器 data-visible；内容常驻 popup-pool，不能以 .rmenu 有无判定） */
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

type MenuMountProps = { scheduled?: boolean; busy?: boolean; anchorKey?: string }

const mountMenu = (props: MenuMountProps = {}) => {
    wrapper = mount(RescheduleMenu, {
        attachTo: document.body,
        props: { scheduled: false, busy: false, ...props },
        slots: {
            // 触发器插槽（模拟 task-bar 三点 / 抽屉「安排到…」）
            trigger: (params: { trigger: (e: Event) => void }) =>
                h('button', { class: 'trig', onClick: (e: Event) => params.trigger(e) }, '触发')
        },
        global: { plugins: [nueUI] }
    })
    return wrapper
}

const openMenu = async (w: VueWrapper): Promise<void> => {
    ;(w.find('.trig').element as HTMLButtonElement).click()
    await nextTick()
    await nextTick()
}

const overlayEl = (): HTMLElement | null =>
    document.body.querySelector<HTMLElement>('.nue-dropdown-overlay')

describe('RescheduleMenu - F4 快速改期菜单（NueDropdown）', () => {
    it('已排期任务：四项 = 今天/明天/下周同日/选择日期…', async () => {
        const w = mountMenu({ scheduled: true })
        await openMenu(w)
        expect(isOpen()).toBe(true)
        expect(menuLabels()).toEqual(['今天', '明天', '下周同日', '选择日期…'])
    })

    it('未安排行：裁剪去「下周同日」= 三项（A1-F4-08）', async () => {
        const w = mountMenu({ scheduled: false })
        await openMenu(w)
        expect(menuLabels()).toEqual(['今天', '明天', '选择日期…'])
    })

    it('首位「今天」点击 → select 上抛今日键并收起（closeWhenExecuted；B7 等价语义入口）', async () => {
        const w = mountMenu({ scheduled: true })
        await openMenu(w)
        itemButton('今天')!.click()
        await nextTick()
        expect(w.emitted('select')?.[0]).toEqual([todayDateKey()])
        expect(isOpen()).toBe(false)
        // 收起时上抛 close（调用方复位态）
        expect(w.emitted('close')).toHaveLength(1)
    })

    it('「明天」→ 目标键为明日（与今天 +1 一致）', async () => {
        const w = mountMenu()
        await openMenu(w)
        itemButton('明天')!.click()
        await nextTick()
        const emittedKey = w.emitted('select')![0]![0] as string
        const expected = todayDateKey()
        const tomorrow = new Date(expected + 'T00:00:00')
        tomorrow.setDate(tomorrow.getDate() + 1)
        const expectedKey = [
            tomorrow.getFullYear(),
            String(tomorrow.getMonth() + 1).padStart(2, '0'),
            String(tomorrow.getDate()).padStart(2, '0')
        ].join('-')
        expect(emittedKey).toBe(expectedKey)
    })

    it('「下周同日」= 锚点日 +7（跨月边界由内核保证；A1-F4-05）', async () => {
        const w = mountMenu({ scheduled: true, anchorKey: '2026-10-31' })
        await openMenu(w)
        itemButton('下周同日')!.click()
        await nextTick()
        expect(w.emitted('select')?.[0]).toEqual(['2026-11-07'])
    })

    it('busy：全部项禁用且点击无副作用（防连点；A1-F4-13）', async () => {
        const w = mountMenu({ scheduled: true, busy: true })
        await openMenu(w)
        const items = [...document.body.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
        expect(items.every((b) => b.disabled)).toBe(true)
        itemButton('今天')!.click()
        await nextTick()
        expect(w.emitted('select')).toBeUndefined()
    })

    it('触发器再次点击 = 收起（toggle）', async () => {
        const w = mountMenu({ scheduled: true })
        await openMenu(w)
        expect(isOpen()).toBe(true)
        ;(w.find('.trig').element as HTMLButtonElement).click()
        await nextTick()
        expect(isOpen()).toBe(false)
        expect(w.emitted('close')).toHaveLength(1)
    })

    it('Esc → close（NueDropdown 内建；A1-F4-11）', async () => {
        const w = mountMenu({ scheduled: true })
        await openMenu(w)
        overlayEl()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        await nextTick()
        expect(isOpen()).toBe(false)
        expect(w.emitted('close')).toHaveLength(1)
    })

    it('外点（点遮罩）→ close（NueDropdown 内建；A1-F4-11）', async () => {
        const w = mountMenu({ scheduled: true })
        await openMenu(w)
        overlayEl()!.click()
        await nextTick()
        expect(isOpen()).toBe(false)
        expect(w.emitted('close')).toHaveLength(1)
    })

    it('「选择日期…」展开内嵌日期面板且不关闭弹层；面板含日期选择器与确定', async () => {
        const w = mountMenu({ scheduled: true })
        await openMenu(w)
        expect(document.body.querySelector('.rmenu__date')).toBeNull()
        itemButton('选择日期…')!.click()
        await nextTick()
        expect(isOpen()).toBe(true)
        expect(document.body.querySelector('.rmenu__date')).toBeTruthy()
        expect(document.body.querySelector('.rmenu__picker')).toBeTruthy()
        expect(document.body.querySelector('.rmenu__confirm')).toBeTruthy()
    })
})