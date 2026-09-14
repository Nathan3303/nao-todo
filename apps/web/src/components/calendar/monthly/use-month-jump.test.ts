// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { useMonthJump } from './use-month-jump'
import MonthJumpPanel from './month-jump-panel.vue'

/**
 * T6-REG-01 防回归：useMonthJump 调用点解构为顶层 ref 后，模板 :open / :x="pos.x" / :y="pos.y"
 * 走 Vue 顶层解包语义。回归（嵌套 ref 访问 mjp.pos.x）会让面板收到 ref 对象 / undefined，
 * 触发 Invalid prop 警告（open=Ref<false> x=undefined y=undefined）。
 * 本测试模拟月/周视图的绑定模式，验证无警告且面板行为正常。
 */

let wrapper: VueWrapper | null = null
let warnSpy: ReturnType<typeof vi.spyOn>

/** 与 monthly/weekly 调用点一致的解构（方案 A）+ 面板绑定 */
const mountHost = (onSelect = vi.fn()): VueWrapper => {
    const Host = defineComponent({
        setup() {
            const { open, pos, titleEl, toggle, close, select } = useMonthJump({ onSelect })
            return { open, pos, titleEl, toggle, close, select }
        },
        template: `
            <div>
                <button ref="titleEl" type="button" data-host-title @click="toggle">标题</button>
                <month-jump-panel
                    :open="open"
                    :x="pos.x"
                    :y="pos.y"
                    :anchor-year="2026"
                    :anchor-month="9"
                    @select="select"
                    @close="close"
                />
            </div>
        `
    })
    wrapper = mount(Host, {
        attachTo: document.body,
        global: { components: { MonthJumpPanel } }
    })
    return wrapper
}

const openPanel = async (w: VueWrapper): Promise<void> => {
    ;(w.find('[data-host-title]').element as HTMLButtonElement).click()
    await nextTick()
}

afterEach(() => {
    warnSpy?.mockRestore()
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

describe('useMonthJump 调用点解构绑定（T6-REG-01 防回归）', () => {
    it('解构为顶层 ref 后 :open/:x/:y 绑定不产生 Invalid prop 警告', () => {
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        mountHost()
        expect(warnSpy).not.toHaveBeenCalled()
    })

    it('toggle 打开面板：渲染于 body，x/y 按收拢规则定位（顶层解包生效）', async () => {
        const w = mountHost()
        await openPanel(w)
        const panel = document.body.querySelector<HTMLElement>('.month-jump-panel')
        expect(panel).toBeTruthy()
        // jsdom rect 全 0 → 收拢到内边距 4
        expect(panel!.style.left).toBe('4px')
        expect(panel!.style.top).toBe('4px')
        // 再点标题 → toggle 收起（焦点归还由宿主持有 titleEl）
        await openPanel(w)
        expect(document.body.querySelector('.month-jump-panel')).toBeNull()
    })

    it('select 上抛（anchorYear 起，目标月）并收起', async () => {
        const onSelect = vi.fn()
        const w = mountHost(onSelect)
        await openPanel(w)
        const monthBtn = [...document.body.querySelectorAll<HTMLElement>('.mjp__month')].find(
            (b) => b.textContent?.trim() === '9 月'
        )!
        monthBtn.click()
        await nextTick()
        expect(onSelect).toHaveBeenCalledWith(2026, 9)
        expect(document.body.querySelector('.month-jump-panel')).toBeNull()
    })
})