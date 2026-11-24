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
 *              ② 选完后面板内控件显示 `2026年07月02日` 式文案，清除键存在且本组件**按 `size="small"`
 *                显式恢复主题的 `padding-right` 预留**（`DEF-129`：预留一旦被 padding 简写清掉，
 *                清除键就压住日历图标）；
 *              ③ 「包含无截止日」点开关 / 点文字 / 点整行空白**三者各切换一次**（真实组件挂载，
 *                断言受控状态与上抛次数，⛔ 不用 stub —— AC 明确要求）；
 *              ④ 无筛选值时底部不出现「清除日期」，有值时出现且点后区间 + 开关一并清空；
 *              ⑤ 窄窗不溢出：面板定宽 14rem、控件 `width: 100%`；
 *              ⑥ 既有 `data-role` 契约由 t770 / t795 / t798 三文件继续守（本文件不改它们）。
 *
 * 返工轮（用户实报「样式还是不对」）：面板改为**逐值复刻**任务详情面板的日期选择器
 * （`task-date-selector.vue`）+ 提醒设置器的开关行，用户口径「直接读…然后复写吧，数据逻辑不变」。
 * ⇒ 原先描述「横排残余」的几条判据（标签色 600 / min-max 宽度 / `padding-right` 不存在）
 * 随需求改判：现断言复刻后的真值（标签色 400、定宽 14rem、清除键让位式存在）。
 */

/** SFC 源码（`?raw`；仅供 CSS 契约断言，DOM 行为一律走真实挂载） */
const rawModules = import.meta.glob('/apps/web/src/components/search/search-due-trigger.vue', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>
const dueTriggerSource = rawModules['/apps/web/src/components/search/search-due-trigger.vue'] ?? ''
/** 空白归一化副本（长选择器会被格式化器折行，逐字符匹配前先折叠空白） */
const dueTriggerSourceFlat = dueTriggerSource.replace(/\s+/g, ' ')

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
const switchRow = () => panel().find('.due-panel__switch-row')
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
        const rowEls = rows()
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

    it('骨架：row → 分隔线 → row → 分隔线 → 开关行（起/止之间也有分隔线，同参考件）', () => {
        mountHarness()
        const children = [...panel().element.children]
        const shape = children.map((el) =>
            el.classList.contains('nue-divider')
                ? 'divider'
                : el.classList.contains('due-panel__row')
                  ? 'row'
                  : el.classList.contains('due-panel__switch-row')
                    ? 'switch'
                    : 'other'
        )
        expect(shape).toEqual(['row', 'divider', 'row', 'divider', 'switch'])
        // 面板为纵向 flex（nue-div vertical ⇒ --nue-div-flex-direction: column）
        expect(
            (panel().element as HTMLElement).style.getPropertyValue('--nue-div-flex-direction')
        ).toBe('column')
    })

    it('有筛选值时才多一条分隔线 + 动作区（无值时不留尾巴分隔线）', () => {
        mountHarness()
        expect(panel().findAll(':scope > .nue-divider')).toHaveLength(2)
        wrapper!.unmount()
        mountHarness({ from: '2026-03-01' })
        expect(panel().findAll(':scope > .nue-divider')).toHaveLength(3)
        const children = [...panel().element.children]
        expect(children.at(-2)!.classList.contains('nue-divider')).toBe(true)
        expect(children.at(-1)!.classList.contains('due-panel__actions')).toBe(true)
    })

    it('源码契约：复刻参考件的关键三行（标签缩进 / 控件 100% / 包裹层 100%）', () => {
        // 标签左缘与控件内文字同缩进（参考件：`padding: 0 var(--nue-padding-xs)`）
        expect(dueTriggerSource).toMatch(
            /\.due-panel__row > \.nue-text\s*\{[^}]*padding:\s*0 var\(--nue-padding-xs\)/m
        )
        expect(dueTriggerSource).toMatch(/\.due-panel__picker\s*\{[^}]*width:\s*100%/m)
        expect(dueTriggerSource).toMatch(
            /\.due-panel__picker > \.nue-date-picker__trigger\s*\{[^}]*width:\s*100%/m
        )
        // 日期是**无框文本行**：去边框/阴影、块向内边距归零（否则看起来像输入框）
        expect(dueTriggerSource).toMatch(
            /\.due-panel__picker \.nue-button\s*\{[^}]*border:\s*none/m
        )
        expect(dueTriggerSource).toMatch(/box-shadow:\s*none/m)
        expect(dueTriggerSource).toMatch(/padding-block:\s*0/m)
        // 取自 `--nue-padding-xs` ⇒ 与标签 padding-left 同值（数值左缘对齐的前提）
        expect(dueTriggerSource).toMatch(/padding-left:\s*var\(--nue-padding-xs\)/m)
    })
})

describe('T755 AC2 · 选完显示完整日期，清除键不与日历图标重叠', () => {
    it('有值时面板内控件显示「2026年07月02日」式文案', () => {
        mountHarness({ from: '2026-07-02' })
        const fromText = panel().find('[data-role="due-from"] .nue-button__text')
        expect(fromText.text()).toBe('2026年07月02日')
    })

    it('清除键随值出现 / 消失；本组件按 `size="small"` 恢复主题给清除键预留的 padding-right', async () => {
        mountHarness()
        expect(panel().find('[data-role="due-from"] .nue-date-picker__clear').exists()).toBe(false)
        wrapper!.unmount()
        mountHarness({ from: '2026-07-02', to: '2026-08-09' })
        await nextTick()
        expect(panel().find('[data-role="due-from"] .nue-date-picker__clear').exists()).toBe(true)
        expect(panel().find('[data-role="due-to"] .nue-date-picker__clear').exists()).toBe(true)
        // `DEF-129`：主题靠 `--clearable .nue-button` 的 padding-right 给绝对定位的清除键留位。
        // 本组件把块向内边距归零（去掉输入框观感）⇒ 必须显式恢复该预留，否则清除键压日历图标。
        expect(dueTriggerSourceFlat).toMatch(
            /\.due-panel__picker \.nue-date-picker__trigger--small\.nue-date-picker__trigger--clearable \.nue-button \{[^}]*padding-right: calc\([^}]*-nue-padding-xs\)/
        )
        // ⛔ 不得用 padding 简写覆盖（会把上面那条一起清掉）
        expect(dueTriggerSource).not.toMatch(/padding:\s*0(?:px|rem)?\s*;/)
    })
})

describe('T755 AC3 · 「包含无截止日」三条点击路径各自切换一次', () => {
    it('开关行：文字在左、开关在右（space-between，同提醒设置器）', () => {
        mountHarness()
        const row = switchRow()
        const children = [...row.element.children]
        expect(children[0]!.classList.contains('due-panel__switch-label')).toBe(true)
        expect(children[1]!.getAttribute('role')).toBe('switch')
        expect(dueTriggerSource).toMatch(
            /\.due-panel__switch-row\s*\{[^}]*justify-content:\s*space-between/m
        )
        expect(dueTriggerSource).toMatch(
            /\.due-panel__switch-row\s*\{[^}]*height:\s*var\(--nue-box-size-xs\)/m
        )
        // 行内缩进与标签/控件一致 ⇒ 三行左缘同一条线
        expect(dueTriggerSource).toMatch(
            /\.due-panel__switch-row\s*\{[^}]*padding:\s*0 var\(--nue-padding-xs\)/m
        )
        // 开关高度取提醒行同值（1.75rem 行里默认高度几乎顶满）
        expect(switchEl().attributes('style')).toContain('--nue-switch-height: 1rem')
    })
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
    it('面板定宽 14rem（与参考件同值，宽度不再可漂移）', () => {
        // 需求变更（返工轮）：由「min 14rem / max 16rem」改为「定宽 14rem」—— 参考件就是定宽，
        // 宽度可漂移会让面板在不同字体的机器上左右缘对不齐。14rem = 224px < 320px 视口，窄屏不溢出。
        expect(dueTriggerSource).toMatch(/\.due-panel\s*\{[^}]*width:\s*14rem/m)
        expect(dueTriggerSource).not.toMatch(/max-width:\s*16rem/)
        expect(dueTriggerSource).not.toMatch(/max-width:\s*20rem/)
        expect(dueTriggerSource).not.toMatch(/min-width:\s*14rem/)
    })

    it('不设固定 px 宽度（可随窄窗收缩，不产生横向滚动）', () => {
        expect(dueTriggerSource).toMatch(/\.due-panel__picker\s*\{[^}]*box-sizing:\s*border-box/m)
        expect(dueTriggerSource).not.toMatch(/width:\s*\d+px/)
    })

    it('间距取参考件值（面板 gap / 行 gap / 内边距），不再用上一版的 sm', () => {
        expect(dueTriggerSource).toMatch(/\.due-panel\s*\{[^}]*gap:\s*var\(--nue-gap-xs\)/m)
        expect(dueTriggerSource).toMatch(
            /\.due-panel\s*\{[^}]*padding:\s*var\(--nue-padding-2xs\) 0/m
        )
        expect(dueTriggerSource).toMatch(/\.due-panel__row\s*\{[^}]*gap:\s*var\(--nue-gap-2xs\)/m)
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