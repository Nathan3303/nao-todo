// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { nextTick, ref, type Ref } from 'vue'
import UndoMessageExtension from '../undo-message-extension.vue'
import type { ScheduleUndoStatus } from '../undo-message'

/**
 * T362/T364 撤销扩展区（NueMessage `extension` 内容）
 * @description 库以独立 render() 根渲染本组件 ⇒ 断言 ① 组件自带依赖（`NueButton` 显式 import
 *              才是原生 `<button>`）；② 取值函数直传时的**响应性**；③ 键盘可达（原生 button）；
 *              ④ 读屏活动区（role=status 只收窄到文本，按钮不被重复播报）；⑤ **T364 状态机**：
 *              idle/busy/undone/failed 的文案与可用性，以及成功终态不丢焦点。
 */

const mountExtension = (
    status: Ref<ScheduleUndoStatus> = ref('idle'),
    undo = vi.fn(),
    retired: Ref<boolean> = ref(false)
): {
    wrapper: ReturnType<typeof mount>
    status: Ref<ScheduleUndoStatus>
    retired: Ref<boolean>
    undo: ReturnType<typeof vi.fn>
} => ({
    wrapper: mount(UndoMessageExtension, {
        // attachTo：jsdom 下游离节点 focus() 不改变 activeElement（键盘可达断言需要真在文档中）
        attachTo: document.body,
        props: {
            text: '已移至 10 月 5 日',
            status: () => status.value,
            retired: () => retired.value,
            undo
        }
    }),
    status,
    retired,
    undo
})

afterEach(() => {
    document.body.innerHTML = ''
})

describe('T362 撤销扩展区（NueMessage extension）', () => {
    it('idle：渲染撤销按钮与读屏活动区（主文案来自动作，按钮文案为「撤销」）', () => {
        const { wrapper } = mountExtension()
        const button = wrapper.get('[data-testid="schedule-undo-action"]')
        expect(button.text()).toBe('撤销')
        expect(button.attributes('aria-disabled')).toBe('false')
        expect(wrapper.get('[role="status"]').text()).toBe('已移至 10 月 5 日')
        expect(wrapper.get('.undo-entry__text').text()).toBe('已移至 10 月 5 日')
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

    it('busy：不可点 + 文案「撤销中…」（响应式随取值函数变化）', async () => {
        const { wrapper, status, undo } = mountExtension(ref('busy'))
        const button = wrapper.get('[data-testid="schedule-undo-action"]')
        expect(button.attributes('aria-disabled')).toBe('true')
        expect(button.text()).toBe('撤销中…')
        await button.trigger('click')
        expect(undo).not.toHaveBeenCalled()

        // 响应性：以取值函数（Ref 直传）表达状态 ⇒ 变化后不重挂载即更新
        status.value = 'idle'
        await wrapper.vm.$nextTick()
        expect(button.attributes('aria-disabled')).toBe('false')
        expect(button.text()).toBe('撤销')
    })

    it('undone（成功终态）：不可点 + 按钮「已撤销」+ 主文案/读屏均变更为「已撤销该调整」', async () => {
        const { wrapper, undo } = mountExtension(ref('undone'))
        const button = wrapper.get('[data-testid="schedule-undo-action"]')
        expect(button.attributes('aria-disabled')).toBe('true')
        expect(button.text()).toBe('已撤销')
        expect(wrapper.get('.undo-entry__text').text()).toBe('已撤销该调整')
        // 读屏活动区（role=status）同步播报成功终态
        expect(wrapper.get('[role="status"]').text()).toBe('已撤销该调整')

        await button.trigger('click')
        expect(undo).not.toHaveBeenCalled()
    })

    it('failed：不显示已撤销、仍可点（按钮「重试」+ 失败文案）', async () => {
        const { wrapper, undo } = mountExtension(ref('failed'))
        const button = wrapper.get('[data-testid="schedule-undo-action"]')
        expect(button.attributes('aria-disabled')).toBe('false')
        expect(button.text()).toBe('重试')
        expect(wrapper.get('.undo-entry__text').text()).toBe('撤销失败，可重试')
        expect(wrapper.text()).not.toContain('已撤销')

        await button.trigger('click')
        expect(undo).toHaveBeenCalledTimes(1)
    })

    it('failed 语义配色：pill 根打上 undo-entry--failed（颜色改指 error 令牌，与文案一致）', async () => {
        const { wrapper, status } = mountExtension(ref('failed'))
        expect(wrapper.get('.undo-entry').classes()).toContain('undo-entry--failed')

        status.value = 'undone'
        await nextTick()
        expect(wrapper.get('.undo-entry').classes()).not.toContain('undo-entry--failed')
    })

    it('retired：已被新消息替换的旧条按钮不可点（防点到淡出旧条撤销最新动作）', async () => {
        const { wrapper, retired, undo } = mountExtension()
        const button = wrapper.get('[data-testid="schedule-undo-action"]')
        expect(button.attributes('aria-disabled')).toBe('false')

        retired.value = true
        await nextTick()
        expect(button.attributes('aria-disabled')).toBe('true')
        await button.trigger('click')
        expect(undo).not.toHaveBeenCalled()
    })

    it('成功终态不把焦点抛回 body（aria-disabled 保留可聚焦性）', async () => {
        const { wrapper, status } = mountExtension()
        const el = wrapper.get('[data-testid="schedule-undo-action"]').element as HTMLButtonElement
        el.focus()
        expect(document.activeElement).toBe(el)

        status.value = 'busy'
        await nextTick()
        status.value = 'undone'
        await nextTick()

        expect(document.activeElement).toBe(el)
        expect(el.getAttribute('aria-disabled')).toBe('true')
    })
})