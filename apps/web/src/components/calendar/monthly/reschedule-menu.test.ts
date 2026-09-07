// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { NueButton, NueDatePicker, NueDivider } from 'nue-ui'
import RescheduleMenu from './reschedule-menu.vue'
import { todayDateKey } from './monthly-layout'

/**
 * F4 快速改期菜单组件级断言（P3-2 / A1-F4-01/02/08/11）
 * @description 菜单项集合与「下周同日」裁剪、今天命中、busy 防连点、外点/Esc 关闭。
 */

const menuEl = () => document.body.querySelector<HTMLElement>('.rmenu')
const menuLabels = () =>
    [...(menuEl()?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])].map((b) =>
        b.textContent?.trim()
    )
const itemButton = (label: string) =>
    [...(menuEl()?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])].find(
        (b) => b.textContent?.trim() === label
    )

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

type MenuMountProps = {
    open?: boolean
    scheduled?: boolean
    busy?: boolean
    anchorKey?: string
}

const mountMenu = (props: MenuMountProps = {}) => {
    wrapper = mount(RescheduleMenu, {
        attachTo: document.body,
        props: { open: true, x: 100, y: 100, scheduled: false, busy: false, ...props },
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

describe('RescheduleMenu - F4 快速改期菜单', () => {
    it('已排期任务：四项 = 今天/明天/下周同日/选择日期…', () => {
        mountMenu({ scheduled: true })
        expect(menuEl()).toBeTruthy()
        expect(menuLabels()).toEqual(['今天', '明天', '下周同日', '选择日期…'])
    })

    it('未安排行：裁剪去「下周同日」= 三项（A1-F4-08）', () => {
        mountMenu({ scheduled: false })
        expect(menuLabels()).toEqual(['今天', '明天', '选择日期…'])
    })

    it('首位「今天」点击 → select 上抛今日日期键（A1-F4-09 B7 等价语义入口）', async () => {
        const w = mountMenu({ scheduled: true })
        itemButton('今天')!.click()
        expect(w.emitted('select')?.[0]).toEqual([todayDateKey()])
        // select 后由父级收起（菜单本身不代收 close）
        expect(w.emitted('close')).toBeUndefined()
    })

    it('「明天」→ 目标键为明日（与今天 +1 一致）', async () => {
        const w = mountMenu()
        itemButton('明天')!.click()
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
        itemButton('下周同日')!.click()
        expect(w.emitted('select')?.[0]).toEqual(['2026-11-07'])
    })

    it('busy：全部项禁用且点击无副作用（防连点；A1-F4-13）', async () => {
        const w = mountMenu({ scheduled: true, busy: true })
        const items = [...menuEl()!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
        expect(items.every((b) => b.disabled)).toBe(true)
        itemButton('今天')!.click()
        expect(w.emitted('select')).toBeUndefined()
    })

    it('外点（pointerdown 落在菜单外）→ close（A1-F4-11）', async () => {
        const w = mountMenu({ scheduled: true })
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        expect(w.emitted('close')).toHaveLength(1)
    })

    it('菜单内 pointerdown 不关闭', async () => {
        const w = mountMenu({ scheduled: true })
        const inside = menuEl()!.querySelector('[role="menuitem"]')!
        inside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        expect(w.emitted('close')).toBeUndefined()
    })

    it('Esc → close（A1-F4-11）', async () => {
        const w = mountMenu({ scheduled: true })
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        expect(w.emitted('close')).toHaveLength(1)
    })
})

describe('RescheduleMenu - 外点豁免收窄（S23 回归）', () => {
    const poolEl = (): HTMLElement => {
        const pool = document.createElement('div')
        pool.className = 'nue-popup-pool'
        document.body.appendChild(pool)
        return pool
    }
    const panelEl = (parent: HTMLElement): HTMLElement => {
        const panel = document.createElement('div')
        panel.className = 'nue-date-picker-panel'
        parent.appendChild(panel)
        return panel
    }
    const fireDown = (target: Element): void => {
        target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    }

    it('根因修复：未展开日期面板时，点 popup-pool 内（抽屉整体所在）元素 = 外点关闭', () => {
        const w = mountMenu({ scheduled: true })
        const pool = poolEl()
        const drawerArea = document.createElement('div')
        pool.appendChild(drawerArea)
        fireDown(drawerArea)
        expect(w.emitted('close')).toHaveLength(1)
    })

    it('触发器（data-rmenu-trigger）pointerdown 不关闭（由触发器自身 toggle 收起）', () => {
        const w = mountMenu({ scheduled: true })
        const trigger = document.createElement('button')
        trigger.dataset.rmenuTrigger = ''
        document.body.appendChild(trigger)
        fireDown(trigger)
        expect(w.emitted('close')).toBeUndefined()
    })

    it('展开日期面板后，点日期选择弹层（nue-date-picker-panel）不关闭', () => {
        const w = mountMenu({ scheduled: true })
        const items = [...(menuEl()!.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
        const item = items.find((b) => b.textContent?.trim() === '选择日期…')!
        item.click() // 展开面板
        const pool = poolEl()
        const panel = panelEl(pool)
        fireDown(panel)
        expect(w.emitted('close')).toBeUndefined()
    })
})