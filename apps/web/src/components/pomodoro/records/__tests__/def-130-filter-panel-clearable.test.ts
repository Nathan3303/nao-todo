// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { PomodoroViewObject } from '@nao-todo/domain-pomodoro'
import { nueUI } from '@/nue-ui-register'
import FilterPanel from '../filter-panel.vue'
import type { PomodoroRecordsFilterState } from '../types'

/**
 * DEF-130 —— `filter-panel.vue`「专注模板」选择器的清除键
 *
 * @description 现状：`<nue-select clearabl>`（少一个 `e`）⇒ 布尔 prop 恒为假 ⇒
 *              `nue-select` 内部 `clearable && selectedOption` 恒假 ⇒ **从不渲染清除键**，
 *              用户在筛选面板选了模板只能改选、不能一键清除。
 *
 * 验证口径（`AGENTS.md`「前端验证纪律」：禁 stub 推断）：**真实挂载**筛选面板 + 真实 `nue-*`，
 * 断言 `nue-select` 清除键（`button[aria-label="清除选择"]`）存在、可点击、点击后值回到「全部」/空。
 * 红基线：把 `clearable` 改回 `clearabl` ⇒ 本文件首例必红（清除键不存在）。
 *
 * ⚠️ 清除键须**按所属选择器定位**：同面板「类型」选择器的「全部」选项 `:value="void 0"`
 *    会让 `nue-select` 在 `modelValue === undefined` 时也命中该选项并渲染清除键（上游既有行为），
 *    全局 `find('button[aria-label="清除选择"]')` 会先命中它 ⇒ 必须限定在「专注模板」触发器内。
 */

const POMODOROS = [
    { id: 'p1', name: '模板A' },
    { id: 'p2', name: '模板B' }
] as unknown as PomodoroViewObject[]

const makeFilters = (
    overrides: Partial<PomodoroRecordsFilterState> = {}
): PomodoroRecordsFilterState => ({
    startTime: '',
    endTime: '',
    type: undefined,
    taskName: '',
    pomodoroId: '',
    ...overrides
})

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const mountPanel = async (filters: PomodoroRecordsFilterState) => {
    wrapper = mount(FilterPanel, {
        attachTo: document.body,
        props: { filters, pomodoros: POMODOROS },
        global: { plugins: [nueUI] }
    })
    // `nue-select` 在 `onMounted` 里把 `modelValue` 映射成 `selectedOption`（shallowRef）
    // ⇒ 必须等一个 tick，DOM 才会渲染出清除键（`clearable && selectedOption`）
    await flushPromises()
    return wrapper
}

/** 「专注模板」选择器 = 当前值 `p1` 的那个 `nue-select` */
const pomodoroSelectOf = (w: VueWrapper) =>
    w.findAllComponents({ name: 'NueSelect' }).find((s) => s.props('modelValue') === 'p1')

/** 「专注模板」触发器 DOM（内含已选模板名） */
const pomodoroTriggerOf = (): HTMLElement => {
    const trigger = [...document.querySelectorAll<HTMLElement>('.nue-select__trigger')].find((el) =>
        (el.textContent ?? '').includes('模板A')
    )
    expect(trigger, '未找到「专注模板」选择器的触发器（应含已选模板名）').toBeTruthy()
    return trigger!
}

const CLEAR_BUTTON = 'button[aria-label="清除选择"]'

describe('DEF-130 · 「专注模板」选择器可一键清除（clearable 拼写）', () => {
    it('已选模板时渲染清除键（button[type=button] + 可访问名「清除选择」）', async () => {
        const w = await mountPanel(makeFilters({ pomodoroId: 'p1' }))

        const select = pomodoroSelectOf(w)
        expect(select, '未找到「专注模板」选择器（modelValue=p1）').toBeTruthy()

        const trigger = pomodoroTriggerOf()
        const clears = [...trigger.querySelectorAll<HTMLButtonElement>(CLEAR_BUTTON)]
        expect(
            clears.length,
            `「专注模板」触发器实测 HTML：${trigger.outerHTML}；选择器实测值 = ${JSON.stringify(
                select!.props('modelValue')
            )}`
        ).toBe(1)
        const clear = clears[0]!
        expect(clear.tagName).toBe('BUTTON')
        expect(clear.getAttribute('type')).toBe('button')
        expect(clear.getAttribute('aria-label')).toBe('清除选择')
    })

    it('点击清除键 ⇒ 值回到「全部」/空，且页面显示「全部」', async () => {
        const w = await mountPanel(makeFilters({ pomodoroId: 'p1' }))
        const select = pomodoroSelectOf(w)!
        expect(select.text(), '清除前应显示已选模板名').toContain('模板A')

        const trigger = pomodoroTriggerOf()
        const clear = trigger.querySelector<HTMLButtonElement>(CLEAR_BUTTON)
        expect(!!clear, '清除键不存在 ⇒ 用户无法一键清除（DEF-130 现象）').toBe(true)
        clear!.click()
        await flushPromises()

        const value = select.props('modelValue')
        expect(
            value === undefined || value === '',
            `清除后应回到「全部」/空，实测 = ${JSON.stringify(value)}`
        ).toBe(true)
        // 触发器节点在 patch 中复用 ⇒ 仍可直接断言它的子元素与文本
        expect(trigger.querySelector(CLEAR_BUTTON), '未选值时清除键应消失').toBeNull()
        expect(trigger.textContent, '清除后触发器应显示「全部」').toContain('全部')
        expect(trigger.textContent, '清除后不应再显示已选模板名').not.toContain('模板A')
    })
})