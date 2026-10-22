// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import {
    NueButton,
    NueCollapse,
    NueCollapseItem,
    NueDiv,
    NueLink,
    NueText,
    NueTooltip
} from 'nue-ui'
import { NaoSmartList } from '../index'

/**
 * T523 SmartList 表头宽度（Issue #226）
 * @description jsdom 无布局 ⇒ 运行时只断言**结构与文案契约**（名称 / 计数 / 全文提示 / 动作区），
 *              样式契约读 CSS 源码；真实几何（容器宽 / 标题框宽 / 动作区宽 / 省略号生效）由交付回执
 *              给 headless Chromium 实测数字。
 * @see docs/prds/2026-10-22-smart-list-title-width.md（§三 范围 1–4 · §五 不变量 1–6 · §七 AC1–AC6）
 */

/** CSS 源码（`?raw`，与仓内既有样式契约测试同法） */
const cssModules = import.meta.glob('/packages/shared/components/smart-list/smart-list.css', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>
const smartListCss = cssModules['/packages/shared/components/smart-list/smart-list.css'] ?? ''

/** 取指定选择器（逐字匹配 `选择器 {`）的首个规则体 */
const ruleBody = (selector: string): string => {
    const start = smartListCss.indexOf(`${selector} {`)
    if (start < 0) return ''
    const open = start + selector.length + 2
    return smartListCss.slice(open, smartListCss.indexOf('}', open))
}

/** `router-link` 桩：本批只测表头 / 行结构，不引入路由 */
const RouterLinkStub = defineComponent({ name: 'RouterLinkStub', template: '<a><slot /></a>' })

const globalOptions = {
    components: {
        NueButton,
        NueCollapse,
        NueCollapseItem,
        NueDiv,
        NueLink,
        NueText,
        NueTooltip,
        'router-link': RouterLinkStub
    }
}

let wrapper: VueWrapper | null = null

const mountList = (listProps: Record<string, unknown> = {}): VueWrapper => {
    const Host = defineComponent({
        setup: () => () =>
            h(
                NueCollapse,
                { modelValue: ['smart'], theme: 'menu' },
                {
                    default: () =>
                        h(NaoSmartList, { collapseItemName: 'smart', links: [], ...listProps })
                }
            )
    })
    wrapper = mount(Host, { global: globalOptions })
    return wrapper
}

const longName = '2026 Q4 产品迭代待办清单（十月）'

describe('T523 SmartList 表头：名称 / 计数 / 全文提示（结构契约）', () => {
    it('AC2/AC3：名称带 title 全文，计数与名称同区且在其后', () => {
        mountList({ name: longName, count: 128 })

        const name = wrapper!.find('.nue-text--name')
        expect(name.exists()).toBe(true)
        expect(name.text()).toBe(longName)
        // 真溢出时的全文出口（原生 title，零 JS 监听）
        expect(name.attributes('title')).toBe(longName)

        const count = wrapper!.find('.nue-text--count')
        expect(count.exists()).toBe(true)
        expect(count.text()).toBe('128')

        // 计数与名称同属标题区（同一父层），且计数在名称之后
        expect(count.element.parentElement).toBe(name.element.parentElement)
        const kids = Array.from(name.element.parentElement!.children)
        expect(kids.indexOf(name.element)).toBeLessThan(kids.indexOf(count.element))
    })

    it('AC5：对外 API 不变 —— 默认两动作按钮', () => {
        mountList({ name: '清单', count: 3 })
        expect(wrapper!.findAll('.nue-div--actions button').length).toBe(2)
    })

    it('AC5：`#actions` 插槽可整体替换默认动作区（对外 API 不变）', () => {
        const Host = defineComponent({
            components: { NaoSmartList },
            template: `<nue-collapse :model-value="['s']" theme="menu">
                    <nao-smart-list collapse-item-name="s" name="清单" :count="3" :links="[]">
                        <template #actions><span class="probe-action">X</span></template>
                    </nao-smart-list>
                </nue-collapse>`
        })
        wrapper = mount(Host, { global: globalOptions })

        expect(wrapper.findAll('.nue-div--actions button').length).toBe(0)
        expect(wrapper.find('.probe-action').exists()).toBe(true)
        // 标题区不受动作区替换影响
        expect(wrapper.find('.nue-text--name').text()).toBe('清单')
        expect(wrapper.find('.nue-text--count').text()).toBe('3')
    })

    it('AC2：行内名称同样给出 title 全文（行上省略时可读全名）', () => {
        mountList({
            name: '清单',
            count: 1,
            links: [{ id: 'l1', title: longName, icon: 'ntd-fanqie', route: '/tasks' }]
        })

        const link = wrapper!.find('.nue-link')
        expect(link.exists()).toBe(true)
        expect(link.attributes('title')).toBe(longName)
        expect(link.find('.nue-link__content').text()).toBe(longName)
    })
})

describe('T523 表头样式契约（AC1 / AC3 / AC6 ②）', () => {
    it('AC1/AC6 ②：标题区可伸缩且可收缩（flex: 1 1 auto + min-width: 0）', () => {
        const titleBtn = ruleBody('.nue-collapse-item__header > .nue-button')
        expect(titleBtn).toContain('flex: 1 1 auto')
        expect(titleBtn).toContain('min-width: 0')

        // 库按钮的文本槽（clamped 那层，由子组件渲染）必须可收缩，否则长单词不省略
        const textSlot = ruleBody(
            '.nue-collapse-item--smart-list :deep(.nue-button > .nue-button__text)'
        )
        expect(textSlot).toContain('flex: 1 1 auto')
        expect(textSlot).toContain('min-width: 0')
    })

    it('AC2/AC6 ②：名称单行 + 末尾省略，计数不参与收缩', () => {
        const name = ruleBody('> .nue-text--name')
        expect(name).toContain('min-width: 0')
        expect(name).toContain('overflow: hidden')
        expect(name).toContain('text-overflow: ellipsis')
        expect(name).toContain('white-space: nowrap')

        const count = ruleBody('> .nue-text--count')
        expect(count).toContain('flex: none')
    })

    it('不变量 2：动作区固定内容宽（不被长标题挤压）', () => {
        expect(ruleBody('.nue-div--actions')).toContain('flex: none')
    })

    it('AC2（实测发现的附加修正）：行内名称单行（防折行被行高垂直硬切）', () => {
        const content = ruleBody(
            '.nue-collapse-item--smart-list :deep(.nue-link > .nue-link__content)'
        )
        expect(content).toContain('white-space: nowrap')
        expect(content).toContain('min-width: 0')
    })

    it('`:deep()` 规则放在顶层（嵌套块内会被展开成「父选择器 + [data-v]」⇒ 永不匹配）', () => {
        expect(smartListCss).toMatch(/^\.nue-collapse-item--smart-list :deep\(/m)
    })
})