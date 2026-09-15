// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { defineComponent } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { InnerDropdown } from '@nao-todo/shared'
import CalendarSortDropdown from '../calendar-sort-dropdown.vue'
import type { CalendarSort } from '../calendar-sort'
import { nueUI } from '@/nue-ui-register'

/**
 * TASK-08 排序下拉组件（展示层）
 * @description 触发按钮渲染；字段/升降序两级结构；默认「按名称」= 未选字段；
 *              选择字段默认升序；未选字段时升降序禁用。
 *              交互经 InnerDropdown 的 execute 事件驱动（与 sort-operator 同款两级结构）。
 */

const mountHost = (modelValue: CalendarSort): VueWrapper => {
    const Host = defineComponent({
        setup() {
            return { modelValue }
        },
        template: `<calendar-sort-dropdown v-model="modelValue" />`
    })
    return mount(Host, {
        attachTo: document.body,
        global: { plugins: [nueUI], components: { CalendarSortDropdown } }
    })
}

/** 字段下拉（第 1 个）/ 升降序下拉（第 2 个） */
const fieldDropdown = (w: VueWrapper) =>
    w.findComponent(CalendarSortDropdown).findAllComponents(InnerDropdown)[0]!
const orderDropdown = (w: VueWrapper) =>
    w.findComponent(CalendarSortDropdown).findAllComponents(InnerDropdown)[1]!

const lastEmit = (w: VueWrapper): CalendarSort | undefined =>
    w.findComponent(CalendarSortDropdown).emitted('update:modelValue')?.at(-1)?.[0] as
        | CalendarSort
        | undefined

describe('CalendarSortDropdown - 排序下拉', () => {
    it('渲染触发按钮（select 图标 / 日历排序 title）', () => {
        const w = mountHost({ order: 'asc' })
        expect(w.find('button[title="日历排序"]').exists()).toBe(true)
        w.unmount()
    })

    it('字段/升降序两级结构：未选字段时升降序禁用', () => {
        const w = mountHost({ order: 'asc' })
        expect(fieldDropdown(w).props('disabled')).toBeFalsy()
        expect(orderDropdown(w).props('disabled')).toBe(true)
        w.unmount()
    })

    it('已选字段时升降序可用', () => {
        const w = mountHost({ field: 'priority', order: 'asc' })
        expect(orderDropdown(w).props('disabled')).toBe(false)
        w.unmount()
    })

    it('选择字段 → 上抛该字段 + 默认升序', () => {
        const w = mountHost({ order: 'asc' })
        fieldDropdown(w).vm.$emit('execute', 'priority')
        expect(lastEmit(w)).toEqual({ field: 'priority', order: 'asc' })
        w.unmount()
    })

    it('选择「默认（按名称）」→ 上抛 field 缺省 + 升序', () => {
        const w = mountHost({ field: 'createdAt', order: 'desc' })
        fieldDropdown(w).vm.$emit('execute', 'none')
        expect(lastEmit(w)).toEqual({ field: undefined, order: 'asc' })
        w.unmount()
    })

    it('选择降序 → 保留当前字段并置 desc', () => {
        const w = mountHost({ field: 'startAt', order: 'asc' })
        orderDropdown(w).vm.$emit('execute', 'desc')
        expect(lastEmit(w)).toEqual({ field: 'startAt', order: 'desc' })
        w.unmount()
    })
})