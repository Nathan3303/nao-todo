// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { useMonthJump } from './use-month-jump'
import CalendarMonthGrid from './calendar-month-grid.vue'
import { nueUI } from '@/nue-ui-register'

/**
 * TASK-09 useMonthJump（NueDropdown 迁移）
 * @description 组合式：execute 解析 "YYYY-MM-01" → onSelect(year, month)；开合态同步；
 *              关闭归还焦点到标题。集成：真实 NueDropdown 触发器绑定无 prop 警告、
 *              标题开合 / 月格即点即跳即关 / 焦点回收。
 */

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

// —— 组合式单元 ——

describe('useMonthJump - execute 解析与开合/焦点', () => {
    it('onExecute 解析 "YYYY-MM-01" → onSelect(年, 月)', () => {
        const onSelect = vi.fn()
        const { onExecute } = useMonthJump({ onSelect })
        onExecute('2026-09-01')
        expect(onSelect).toHaveBeenCalledWith(2026, 9)
        onExecute('2027-12-01')
        expect(onSelect).toHaveBeenLastCalledWith(2027, 12)
    })

    it('非法 execute id（无年月前缀）不触发跳转', () => {
        const onSelect = vi.fn()
        const { onExecute } = useMonthJump({ onSelect })
        onExecute('')
        onExecute('garbage')
        onExecute('2026')
        expect(onSelect).not.toHaveBeenCalled()
    })

    it('onOpen/onClose 同步开合态；关闭归还焦点到标题', async () => {
        const { open, onOpen, onClose, titleEl } = useMonthJump({ onSelect: vi.fn() })
        const focus = vi.fn()
        titleEl.value = { focus } as unknown as HTMLElement

        onOpen()
        expect(open.value).toBe(true)

        onClose()
        expect(open.value).toBe(false)
        await nextTick()
        expect(focus).toHaveBeenCalledTimes(1)

        // 非 ref 元素（未挂载）关闭不抛
        titleEl.value = null
        onClose()
        await nextTick()
    })
})

// —— 真实 NueDropdown 集成（REG-01 绑定语义迁移） ——

const mountHost = (onSelect = vi.fn()): VueWrapper => {
    const Host = defineComponent({
        setup() {
            const { titleEl, open, onOpen, onClose, onExecute } = useMonthJump({ onSelect })
            return { titleEl, open, onOpen, onClose, onExecute }
        },
        template: `
            <nue-dropdown
                placement="bottom-start"
                group="calendar-month-jump"
                close-when-executed
                @open="onOpen"
                @close="onClose"
                @execute="onExecute"
            >
                <template #trigger="{ trigger }">
                    <button ref="titleEl" type="button" data-host-title @click="trigger">标题</button>
                </template>
                <calendar-month-grid :anchor-year="2026" :active="open" />
            </nue-dropdown>
        `
    })
    wrapper = mount(Host, {
        attachTo: document.body,
        global: { plugins: [nueUI], components: { CalendarMonthGrid } }
    })
    return wrapper
}

const openDropdown = async (w: VueWrapper): Promise<void> => {
    ;(w.find('[data-host-title]').element as HTMLButtonElement).click()
    await nextTick()
    await nextTick()
}

const visibleWrapper = (): Element | null =>
    document.body.querySelector('.nue-dropdown-wrapper[data-visible="true"]')

describe('useMonthJump - 真实 NueDropdown 集成', () => {
    it('顶层 ref 绑定 :active / :anchor-year 不产生 Invalid prop 警告', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        mountHost()
        expect(warnSpy).not.toHaveBeenCalled()
        warnSpy.mockRestore()
    })

    it('点击标题展开弹层（wrapper data-visible=true），网格渲染 12 月格', async () => {
        const w = mountHost()
        expect(visibleWrapper()).toBeNull()
        await openDropdown(w)
        expect(visibleWrapper()).toBeTruthy()
        expect(document.body.querySelectorAll('.mjp__month').length).toBe(12)
    })

    it('月格 data-executeid 触发 execute → onSelect(年, 月) 且弹层关闭', async () => {
        const onSelect = vi.fn()
        const w = mountHost(onSelect)
        await openDropdown(w)
        const month = [...document.body.querySelectorAll<HTMLButtonElement>('.mjp__month')].find(
            (b) => b.dataset.executeid === '2026-09-01'
        )!
        month.click()
        await nextTick()
        expect(onSelect).toHaveBeenCalledWith(2026, 9)
        expect(visibleWrapper()).toBeNull()
    })

    it('关闭弹层后焦点回到标题按钮', async () => {
        const w = mountHost()
        await openDropdown(w)
        const title = w.find('[data-host-title]').element as HTMLButtonElement
        // 点击标题再次触发 → 收起
        title.click()
        await nextTick()
        await nextTick()
        expect(visibleWrapper()).toBeNull()
        expect(document.activeElement).toBe(title)
    })

    it('年区 ±1 点击不关闭弹层（不携带 execute id）', async () => {
        const w = mountHost()
        await openDropdown(w)
        document.body
            .querySelector<HTMLButtonElement>('.mjp__year-btn[aria-label="下一年"]')!
            .click()
        await nextTick()
        expect(visibleWrapper()).toBeTruthy()
        expect(document.body.textContent).toContain('2027 年')
    })
})