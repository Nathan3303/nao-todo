// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { NueInput } from 'nue-ui'
import TaskNameFilter from '../name-filter.vue'

/**
 * 任务名称筛选框 autocomplete 语义（SHELL-01-DEF-01 回归防护）
 * @description 该输入框常驻 DOM（nue-dropdown 弹层内容常驻仅 CSS 隐藏）且直通
 *              preference.getTasksOptions.name → RefreshData 重拉；浏览器凭据自动填充
 *              曾将账号邮箱写入此处致「name=<邮箱> 空返回 → 任务列表置空」。
 *              修复 = 内层 input autocomplete="off"（非身份字段，屏蔽浏览器填充写入）。
 */
describe('TaskNameFilter autocomplete 语义', () => {
    let wrapper: VueWrapper | null = null

    afterEach(() => {
        wrapper?.unmount()
        wrapper = null
        document.body.innerHTML = ''
    })

    const mountFilter = (modelValue = ''): VueWrapper => {
        wrapper = mount(TaskNameFilter, {
            attachTo: document.body,
            props: { modelValue },
            global: { components: { 'nue-input': NueInput } }
        })
        return wrapper
    }

    it('内层 input 挂载后带 autocomplete="off"（屏蔽浏览器自动填充误写入）', () => {
        mountFilter()
        const input = wrapper!.find('input')
        expect(input.exists()).toBe(true)
        expect(input.attributes('autocomplete')).toBe('off')
    })

    it('用户键入仍正常工作（v-model 经 360ms 防抖上抛 update:modelValue）', async () => {
        const wrapper = mountFilter()
        const input = wrapper.find('input')
        await input.setValue('RD 复现任务')
        // nue-input 内置 360ms debounce（name 筛选链语义），等待防抖触发
        await new Promise((resolve) => setTimeout(resolve, 500))
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['RD 复现任务'])
    })

    it('卸载重挂载属性不残留', async () => {
        const w1 = mountFilter('a')
        w1.unmount()
        const w2 = mountFilter('b')
        expect(w2.find('input').attributes('autocomplete')).toBe('off')
    })
})