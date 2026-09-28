// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { ref, type Ref } from 'vue'
import UndoMessageExtension from '../undo-message-extension.vue'

/**
 * T362 撤销扩展区（NueMessage `extension` 内容）
 * @description 库以独立 render() 根渲染本组件 ⇒ 断言 ① 组件自带依赖（`nue-button` 显式 import
 *              才是原生 `<button>`）；② busy 以取值函数直传时的**响应性**（禁用 + 「撤销中…」）；
 *              ③ 键盘可达（原生 button：可聚焦、非 disabled）；④ 读屏活动区（O8：role=status
 *              只收窄到文本，按钮不被重复播报）。
 */

const mountExtension = (busy: Ref<boolean> = ref(false), undo = vi.fn()) => ({
    wrapper: mount(UndoMessageExtension, {
        // attachTo：jsdom 下游离节点 focus() 不改变 activeElement（键盘可达断言需要真在文档中）
        attachTo: document.body,
        props: { text: '已移至 10 月 5 日', busy: () => busy.value, undo }
    }),
    busy,
    undo
})

afterEach(() => {
    document.body.innerHTML = ''
})

describe('T362 撤销扩展区（NueMessage extension）', () => {
    it('渲染撤销按钮与读屏活动区（文案来自动作，按钮文案为「撤销」）', () => {
        const { wrapper } = mountExtension()
        const button = wrapper.get('[data-testid="schedule-undo-action"]')
        expect(button.text()).toBe('撤销')
        expect(wrapper.get('[role="status"]').text()).toBe('已移至 10 月 5 日')
    })

    it('键盘可达：真实 <button>（可聚焦、非 disabled、type=button）', async () => {
        const { wrapper } = mountExtension()
        const el = wrapper.get('[data-testid="schedule-undo-action"]').element as HTMLButtonElement
        expect(el.tagName).toBe('BUTTON')
        expect(el.getAttribute('type')).toBe('button')
        expect(el.disabled).toBe(false)

        el.focus()
        expect(document.activeElement).toBe(el)
    })

    it('点击 ⇒ 触发撤销一次', async () => {
        const { wrapper, undo } = mountExtension()
        await wrapper.get('[data-testid="schedule-undo-action"]').trigger('click')
        expect(undo).toHaveBeenCalledTimes(1)
    })

    it('busy：按钮禁用 + 文案「撤销中…」+ 点击无副作用（响应式随取值函数变化）', async () => {
        const { wrapper, busy, undo } = mountExtension(ref(true))
        const button = wrapper.get('[data-testid="schedule-undo-action"]')
        expect((button.element as HTMLButtonElement).disabled).toBe(true)
        expect(button.text()).toBe('撤销中…')
        await button.trigger('click')
        expect(undo).not.toHaveBeenCalled()

        // 响应性：以取值函数（Ref 直传）表达 busy ⇒ 变化后不重挂载即更新
        busy.value = false
        await wrapper.vm.$nextTick()
        expect((button.element as HTMLButtonElement).disabled).toBe(false)
        expect(button.text()).toBe('撤销')
    })
})