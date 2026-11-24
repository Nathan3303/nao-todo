// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { nueUI } from '../../../nue-ui-register'
import SearchDueTrigger from '../search-due-trigger.vue'

/**
 * 触发器健壮性（`#398` 二轮 / T795）
 * @description 真实事故：日期选择器输出 ISO 时间（含 `T…`）时，`shortLabel` 走
 *              `Intl.DateTimeFormat().format(Invalid Date)` 抛 `RangeError` ⇒ **渲染中断**，
 *              按钮只剩注释、宽度塌成 padding（用户看到"空胶囊"）。本用例锁两条：
 *              ① 脏日期键不得让渲染抛错（按钮始终有文本）；
 *              ② 输入侧把 ISO 规整为 `YYYY-MM-DD` 再上抛。
 */
beforeEach(() => setActivePinia(createPinia()))

const mountTrigger = (props: { from: string; to: string; includeNoDue?: boolean }) =>
    mount(
        SearchDueTrigger as never,
        {
            props: { includeNoDue: false, ...props },
            global: { plugins: [nueUI] }
        } as never
    )

describe('T795 · 截止日触发器健壮性', () => {
    it('ISO 时间入参（含 T…）不抛错，且摘要按本地日期显示', () => {
        const w = mountTrigger({
            from: '2025-11-01T00:00:00.000Z',
            to: '2026-08-01T12:00:00+08:00'
        })
        const text = w.find('[data-role="due-trigger"]').text()
        expect(text).toContain('截止日')
        expect(text).toMatch(/\d+\/\d+/)
    })

    it('无法解析的脏值不抛错，回退原串展示（⛔ 不塌成空胶囊）', () => {
        const w = mountTrigger({ from: 'not-a-date', to: '' })
        const btn = w.find('[data-role="due-trigger"]')
        expect(btn.text()).toContain('截止日')
        expect(btn.text()).toContain('not-a-date')
    })

    it('选择器输出 ISO 时，上抛的是 YYYY-MM-DD', async () => {
        const w = mountTrigger({ from: '', to: '' })
        const panel = w.find('[data-role="due-from"]')
        expect(panel.exists()).toBe(true)
        await w
            .findComponent({ name: 'NueDatePicker' })
            .vm.$emit('update:modelValue', '2025-11-01T00:00:00.000Z')
        const emitted = w.emitted('update:from')
        expect(emitted?.at(-1)).toEqual(['2025-11-01'])
    })
})