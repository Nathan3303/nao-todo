// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { NueDatePicker, NueSelect, NueSelectOption } from 'nue-ui'

/**
 * T631 S3 · AC8 / R-E：`nue-ui` 1.15.0 起清除控件从 `nue-button` 内嵌（`__append > i`）
 * 迁出，变成触发器同级原生 `<button class="…__clear">`。本用例锁新结构下的三件事：
 *   ① 清除键存在、是原生 `button[type=button]`、带可访问名 ⇒ 键盘可达（原生按钮语义）；
 *   ② `focus()` 后 `document.activeElement` 命中 ⇒ 确实可聚焦；点击后值被清空、清除键消失；
 *   ③ `disabled` 跟随：宿主 disabled 时清除键带 `disabled` 属性。
 *
 * 口径：jsdom 不做布局计算，面板内 picker 触发按钮宽度归「结构判据 + 用户走查」，
 * 本用例不涉及宽度；`:focus-visible` 环同理（上游主题自带，jsdom 不计算）。
 */

const mountSelect = (options: { value?: string; disabled?: boolean } = {}) => {
    const model = ref<string | undefined>(options.value)
    const wrapper = mount(
        defineComponent({
            name: 'SelectHost',
            setup: () => () =>
                h(
                    NueSelect,
                    {
                        modelValue: model.value,
                        clearable: true,
                        disabled: options.disabled ?? false,
                        'onUpdate:modelValue': (value: unknown) => {
                            model.value = value as string | undefined
                        }
                    },
                    () => [h(NueSelectOption, { label: '清单 A', value: 'a' })]
                )
        }),
        { attachTo: document.body }
    )
    return { wrapper, model }
}

const mountDatePicker = (options: { value: string; disabled?: boolean }) => {
    const model = ref<string | null>(options.value)
    const clears: unknown[] = []
    const wrapper = mount(
        defineComponent({
            name: 'DatePickerHost',
            setup: () => () =>
                h(NueDatePicker, {
                    modelValue: model.value,
                    type: 'date',
                    clearable: true,
                    disabled: options.disabled ?? false,
                    'onUpdate:modelValue': (value: unknown) => {
                        model.value = value as string | null
                    },
                    onClear: () => clears.push(true)
                })
        }),
        { attachTo: document.body }
    )
    return { wrapper, model, clears }
}

describe('T631 S3 · AC8 清除键（nue-ui 1.15.x 新结构）', () => {
    it('nue-select：清除键为原生 button、可聚焦、点击清空值并消失；disabled 跟随', async () => {
        const { wrapper, model } = mountSelect()
        await nextTick()
        // 选项注册完成后再给值，确保 selectedOption 同步（上游 watch(modelValue) 语义）
        model.value = 'a'
        await nextTick()

        const clear = wrapper.find('.nue-select__clear')
        expect(clear.exists()).toBe(true)
        expect(clear.attributes('type')).toBe('button')
        expect(clear.attributes('aria-label')).toBe('清除选择')
        expect(clear.attributes('disabled')).toBeUndefined()

        const button = clear.element as HTMLButtonElement
        button.focus()
        expect(document.activeElement).toBe(button)

        await clear.trigger('click')
        await nextTick()
        expect(model.value).toBeUndefined()
        expect(wrapper.find('.nue-select__clear').exists()).toBe(false)
        wrapper.unmount()

        const disabledHost = mountSelect({ value: 'a', disabled: true })
        await nextTick()
        const disabledClear = disabledHost.wrapper.find('.nue-select__clear')
        expect(disabledClear.exists()).toBe(true)
        expect(disabledClear.attributes('disabled')).toBeDefined()
        disabledHost.wrapper.unmount()
    })

    it('nue-date-picker：清除键为原生 button、可聚焦、点击清空值 + 抛 clear；disabled 跟随', async () => {
        const { wrapper, model, clears } = mountDatePicker({ value: '2026-11-02' })

        const clear = wrapper.find('.nue-date-picker__clear')
        expect(clear.exists()).toBe(true)
        expect(clear.attributes('type')).toBe('button')
        expect(clear.attributes('aria-label')).toBe('清除日期')
        expect(clear.attributes('disabled')).toBeUndefined()

        const button = clear.element as HTMLButtonElement
        button.focus()
        expect(document.activeElement).toBe(button)

        await clear.trigger('click')
        await nextTick()
        expect(model.value).toBeNull()
        expect(clears).toHaveLength(1)
        expect(wrapper.find('.nue-date-picker__clear').exists()).toBe(false)
        wrapper.unmount()

        const disabledHost = mountDatePicker({ value: '2026-11-02', disabled: true })
        await nextTick()
        const disabledClear = disabledHost.wrapper.find('.nue-date-picker__clear')
        expect(disabledClear.exists()).toBe(true)
        expect(disabledClear.attributes('disabled')).toBeDefined()
        disabledHost.wrapper.unmount()
    })
})