// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { defineComponent, nextTick, reactive } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { setLocale } from '@nao-todo/shared/locales'
import { nueUI } from '../../../nue-ui-register'
import SearchDueTrigger from '../search-due-trigger.vue'

/**
 * T755 · 截止日筛选面板竖排重构（Issue #403）
 *
 * @description 验收口径逐条对应 Issue AC：
 *              ① 起/止为「标签在上 + 控件全宽」的竖排段，控件左右缘对齐；
 *              ② 选完后面板内控件显示 `2026年07月02日` 式文案，清除键存在且本组件不覆盖其右侧预留
 *                （覆盖会压住日历图标，`DEF-129` 同类事故）；
 *              ③ 「包含无截止日」点开关 / 点文字 / 点整行空白**三者各切换一次**（真实组件挂载，
 *                断言受控状态与上抛次数，⛔ 不用 stub —— AC 明确要求）；
 *              ④ 无筛选值时底部不出现「清除日期」，有值时出现且点后区间 + 开关一并清空；
 *              ⑤ 窄窗不溢出：宽度上限 16rem / 下限 14rem、控件 `width: 100%` + `min-width: 0`；
 *              ⑥ 既有 `data-role` 契约由 t770 / t795 / t798 三文件继续守（本文件不改它们）。
 *
 * jsdom 不可测部分（留给用户视觉走查）：真实像素宽度、横向滚动条、清除键与日历图标的实际间距。
 */

/** SFC 源码（`?raw`；仅供 CSS 契约断言，DOM 行为一律走真实挂载） */
const rawModules = import.meta.glob('/apps/web/src/components/search/search-due-trigger.vue', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>
const dueTriggerSource = rawModules['/apps/web/src/components/search/search-due-trigger.vue'] ?? ''

/**
 * 受控宿主：复刻 use-search 的接线（值回流 + clear 一并复位）⇒ 断言的是「状态与结果一致」
 *
 * @description 初值必须在 **挂载时落定**（⛔ 不要挂载后再改 `vm.xxx`）：后者会触发一次重渲染，
 *              期间 nue-date-picker 的内部面板会内联进 DOM，污染面板文本断言。
 */
type HarnessState = { from: string; to: string; includeNoDue: boolean }
type HarnessProps = Partial<HarnessState>

const makeHarness = (initial: HarnessProps = {}) => {
    const state = reactive<HarnessState>({
        from: initial.from ?? '',
        to: initial.to ?? '',
        includeNoDue: initial.includeNoDue ?? false
    })
    const component = defineComponent({
        components: { SearchDueTrigger },
        setup: () => ({ state }),
        template: `<search-due-trigger
        :from="state.from"
        :to="state.to"
        :include-no-due="state.includeNoDue"
        @update:from="state.from = $event"
        @update:to="state.to = $event"
        @update:include-no-due="state.includeNoDue = $event"
        @clear="state.from = ''; state.to = ''; state.includeNoDue = false"
    />`
    })
    return { component, state }
}

let wrapper: VueWrapper | null = null
let state: HarnessState | null = null

const mountHarness = (initial: HarnessProps = {}) => {
    const harness = makeHarness(initial)
    state = harness.state
    wrapper = mount(harness.component, {
        global: { plugins: [nueUI] },
        attachTo: document.body
    })
    return wrapper
}

const panel = () => wrapper!.find('.due-panel')
const rows = () => panel().findAll('.due-panel__row')
const switchRow = () => panel().find('.due-panel__row--switch')
const switchEl = () => switchRow().find('[role="switch"]')
const switchLabel = () => switchRow().find('.due-panel__switch-label')
const clearButton = () => panel().find('.due-panel__clear')

/** 真实点击（冒泡），用于区分「点开关 / 点文字 / 点整行空白」三条路径 */
const click = async (el: Element) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await nextTick()
    await nextTick()
}

const emittedInclude = () => wrapper!.findComponent(SearchDueTrigger).emitted('update:includeNoDue')

beforeEach(() => {
    setActivePinia(createPinia())
    setLocale('zh-CN')
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    state = null
    setLocale('zh-CN')
    document.body.innerHTML = ''
})

describe('T755 AC1 · 起/止为竖排段（标签在上、控件全宽）', () => {
    it('两个日期段各自是一个行容器：标签在前、选择器在后', () => {
        mountHarness()
        const rowEls = rows().filter((row) => !row.classes().includes('due-panel__row--switch'))
        expect(rowEls).toHaveLength(2)
        for (const row of rowEls) {
            const children = row.element.children
            expect(children[0]!.classList.contains('due-panel__label')).toBe(true)
            expect(children[1]!.classList.contains('nue-date-picker')).toBe(true)
        }
        const [fromRow, toRow] = rowEls
        expect(fromRow!.text()).toContain('起始日')
        expect(toRow!.text()).toContain('结束日')
    })

    it('两段之间 / 段与开关行 / 开关行与动作区之间用分隔线分段', () => {
        mountHarness({ from: '2026-03-01' })
        expect(panel().findAll(':scope > .nue-divider')).toHaveLength(2)
        const structure = panel().element
        expect(structure.getAttribute('class')).toContain('due-panel')
        // 面板为纵向 flex（nue-div vertical ⇒ --nue-div-flex-direction: column）
        expect((structure as HTMLElement).style.getPropertyValue('--nue-div-flex-direction')).toBe(
            'column'
        )
    })

    it('源码契约：标签在上用 `vertical` 行、控件 100% 宽（含 `__trigger` 包裹层）', () => {
        expect(dueTriggerSource).toMatch(/\.due-panel__label\s*\{[^}]*color:/m)
        expect(dueTriggerSource).toMatch(/\.due-panel__picker\s*\{[^}]*width:\s*100%/m)
        expect(dueTriggerSource).toMatch(/\.nue-date-picker__trigger\)\s*\{[^}]*width:\s*100%/m)
    })
})

describe('T755 AC2 · 选完显示完整日期，清除键不与日历图标重叠', () => {
    it('有值时面板内控件显示「2026年07月02日」式文案', () => {
        mountHarness({ from: '2026-07-02' })
        const fromText = panel().find('[data-role="due-from"] .nue-button__text')
        expect(fromText.text()).toBe('2026年07月02日')
    })

    it('清除键随值出现 / 消失；本组件不覆盖主题给清除键预留的 padding-right', async () => {
        mountHarness()
        expect(panel().find('[data-role="due-from"] .nue-date-picker__clear').exists()).toBe(false)
        wrapper!.unmount()
        mountHarness({ from: '2026-07-02', to: '2026-08-09' })
        await nextTick()
        expect(panel().find('[data-role="due-from"] .nue-date-picker__clear').exists()).toBe(true)
        expect(panel().find('[data-role="due-to"] .nue-date-picker__clear').exists()).toBe(true)
        // 主题用 padding-right 给清除键留位（DEF-129）；组件若再用 padding 简写覆盖 ⇒ 图标被压
        expect(dueTriggerSource).not.toMatch(/padding-right:/)
        expect(dueTriggerSource).not.toMatch(/padding:\s*0\b/)
    })
})

describe('T755 AC3 · 「包含无截止日」三条点击路径各自切换一次', () => {
    it('点开关：切换一次（不因冒泡与整行各抛一次而相互抵消）', async () => {
        mountHarness()
        await click(switchEl().element)
        expect(emittedInclude()).toHaveLength(1)
        expect(emittedInclude()![0]).toEqual([true])
        expect(switchEl().attributes('aria-checked')).toBe('true')
    })

    it('点文字：切换一次', async () => {
        mountHarness()
        await click(switchLabel().element)
        expect(emittedInclude()).toHaveLength(1)
        expect(emittedInclude()![0]).toEqual([true])
        expect(switchEl().attributes('aria-checked')).toBe('true')
    })

    it('点整行空白：切换一次', async () => {
        mountHarness()
        await click(switchRow().element)
        expect(emittedInclude()).toHaveLength(1)
        expect(emittedInclude()![0]).toEqual([true])
        expect(switchEl().attributes('aria-checked')).toBe('true')
    })

    it('三条路径交替点击 ⇒ 状态逐次取反且每次只抛一次', async () => {
        mountHarness()
        await click(switchEl().element)
        expect(switchEl().attributes('aria-checked')).toBe('true')
        await click(switchLabel().element)
        expect(switchEl().attributes('aria-checked')).toBe('false')
        await click(switchRow().element)
        expect(switchEl().attributes('aria-checked')).toBe('true')
        expect(emittedInclude()).toHaveLength(3)
    })
})

describe('T755 AC4 · 「清除日期」仅在有效值时出现，且一并清空', () => {
    it('无筛选值：底部无动作区（分隔线也不出现）', () => {
        mountHarness()
        expect(panel().find('.due-panel__actions').exists()).toBe(false)
        expect(clearButton().exists()).toBe(false)
    })

    it('有值时出现且可点击；点击后区间与开关一并清空', async () => {
        mountHarness({ from: '2026-03-01', to: '2026-03-05', includeNoDue: true })
        expect(clearButton().exists()).toBe(true)
        expect(clearButton().text()).toContain('清除日期')
        await click(clearButton().element)
        expect(state!.from).toBe('')
        expect(state!.to).toBe('')
        expect(state!.includeNoDue).toBe(false)
        expect(panel().find('.due-panel__actions').exists()).toBe(false)
        // 即时生效：面板内没有「取消 / 保存」这类提交式按钮
        const texts = panel()
            .findAll('.nue-button')
            .map((button) => button.text())
        expect(texts.every((text) => !/取消|保存|Cancel|Save/.test(text))).toBe(true)
    })

    it('只有开关打开（无起止日）不算有效区间 ⇒ 不出现「清除日期」', () => {
        mountHarness({ includeNoDue: true })
        expect(clearButton().exists()).toBe(false)
    })
})

describe('T755 AC5 · 窄窗宽度契约', () => {
    it('面板 14rem 起、16rem 封顶（竖排不再占横排的 20rem）', () => {
        expect(dueTriggerSource).toMatch(/\.due-panel\s*\{[^}]*min-width:\s*14rem/m)
        expect(dueTriggerSource).toMatch(/\.due-panel\s*\{[^}]*max-width:\s*16rem/m)
        expect(dueTriggerSource).not.toMatch(/max-width:\s*20rem/)
    })

    it('行容器与控件都不设固定 px 宽度（可随窄窗收缩，不产生横向滚动）', () => {
        expect(dueTriggerSource).toMatch(/\.due-panel__row\s*\{[^}]*min-width:\s*0/m)
        expect(dueTriggerSource).toMatch(/\.due-panel__picker\s*\{[^}]*min-width:\s*0/m)
        expect(dueTriggerSource).not.toMatch(/width:\s*\d+px/)
    })
})

describe('T755 AC6 · data-role 契约全保留', () => {
    it('面板内起/止两个选择器仍带 due-from / due-to，触发器仍带 due-trigger', () => {
        mountHarness()
        expect(wrapper!.find('[data-role="due-trigger"]').exists()).toBe(true)
        expect(panel().find('[data-role="due-from"]').exists()).toBe(true)
        expect(panel().find('[data-role="due-to"]').exists()).toBe(true)
        expect(wrapper!.findAll('[data-role="due-from"]')).toHaveLength(1)
        expect(wrapper!.findAll('[data-role="due-to"]')).toHaveLength(1)
    })
})

describe('T755 · 即时生效链路未变（回归护栏）', () => {
    it('选择器上抛 ISO 时仍归一为 YYYY-MM-DD', async () => {
        mountHarness()
        wrapper!
            .findAllComponents({ name: 'NueDatePicker' })[0]!
            .vm.$emit('update:modelValue', '2025-11-01T00:00:00.000Z')
        await nextTick()
        expect(state!.from).toBe('2025-11-01')
    })
})