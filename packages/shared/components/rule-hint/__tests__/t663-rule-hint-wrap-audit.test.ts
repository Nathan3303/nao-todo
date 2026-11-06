// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { NueDiv, NueIcon, NueText } from 'nue-ui'
import { setLocale, t } from '@nao-todo/shared/locales'
// 直接引 SFC（桶里导出的是 `defineAsyncComponent`，直挂会在解析前拿到空根节点）
import PasswordRuleHint from '../password-rule-hint.vue'
import RuleHint from '../rule-hint.vue'

/**
 * `T663` 末轮 · `DEF-151`：`rule-hint` 换行保护（**源级**断言）+ 2 个**非本批使用点**抽查
 * （`T665` / `87b669e4`）
 *
 * @description PM 口径：换行保护只到 `rule-hint.vue`（⛔ 不动 `nue-ui` 包）；像素/观感归用户走查，
 *              自动化只做**源级**断言 + 「长文案不被截断」的结构断言，**不假装测宽度**。
 *              抽查点（PM 建议）：注册页（实际用的是 `PasswordRuleHint`）+ 清单管理器（`ProjectManager`）。
 */

const NUE = {
    'nue-div': NueDiv,
    'nue-icon': NueIcon,
    'nue-text': NueText
}

/** 取某条选择器的声明块（用于源级样式断言；jsdom 不应用 SFC `<style scoped>`） */
const blockOf = (css: string, selector: string): string => {
    const index = css.indexOf(selector)
    if (index < 0) return ''
    const open = css.indexOf('{', index)
    let depth = 0
    for (let i = open; i < css.length; i += 1) {
        if (css[i] === '{') depth += 1
        else if (css[i] === '}') {
            depth -= 1
            if (depth === 0) return css.slice(open, i + 1)
        }
    }
    return ''
}

const sources = import.meta.glob<string>('/packages/shared/components/rule-hint/rule-hint.vue', {
    query: '?raw',
    import: 'default',
    eager: true
})
const source = (): string => Object.values(sources)[0] ?? ''
const styleOf = (): string => {
    const src = source()
    const start = src.indexOf('<style')
    return start < 0 ? '' : src.slice(start)
}

let mounted: VueWrapper[] = []
beforeEach(() => setLocale('zh-CN'))
afterEach(() => {
    mounted.forEach((w) => w.unmount())
    mounted = []
    document.body.innerHTML = ''
    setLocale('zh-CN')
    vi.restoreAllMocks()
})

describe('T663 末轮 · DEF-151 源级：rule-hint 有换行保护（只改本组件、不碰 nue-ui）', () => {
    it('容器与内容容器都有 min-width: 0，容器与正文都有 overflow-wrap', () => {
        const css = styleOf()
        const container = blockOf(css, '.nue-div--rule-hint {')
        const wrapper = blockOf(css, '.nue-div--rule-hint__content-wrapper')
        const content = blockOf(css, '.nue-text--content')
        console.log(
            '[T663/probe151:css]',
            JSON.stringify({
                containerLen: container.length,
                wrapperLen: wrapper.length,
                contentLen: content.length
            })
        )
        expect(container, '容器规则应存在').not.toBe('')
        expect(container).toMatch(/overflow-wrap:\s*anywhere/)
        expect(container).toMatch(/min-width:\s*0/)
        expect(wrapper, 'flex 子项需 min-width: 0 才能断行').toMatch(/min-width:\s*0/)
        expect(content, '正文兜底一层可断行').toMatch(/overflow-wrap:\s*anywhere/)
    })

    it('仍是 scoped、未用 :deep 改外部组件内部（不另创体系）', () => {
        const src = source()
        console.log(
            '[T663/probe151:scope]',
            JSON.stringify({
                scoped: /<style[^>]*\bscoped\b/.test(src),
                deep: src.includes(':deep(')
            })
        )
        expect(src, '必须 `<style scoped>`').toMatch(/<style[^>]*\bscoped\b/)
        expect(src, '⛔ 不得用 :deep 改 nue-ui 内部').not.toContain(':deep(')
    })
})

describe('T663 末轮 · 非本批使用点抽查（长文案不被截断 / 结构不变）', () => {
    it('注册页（`password-rule-hint.vue`）：多行长文案完整渲染，无截断类名', async () => {
        const wrapper = mount(PasswordRuleHint, {
            global: { components: NUE }
        })
        mounted.push(wrapper)
        await nextTick()

        const expected = t('component.passwordHint.content')
        const contentEl = wrapper.find('.nue-text--content')
        const text = contentEl.exists() ? ((contentEl.element as Element).textContent ?? '') : ''
        const title = wrapper.find('.nue-text--title').text()
        console.log(
            '[T663/probe151:signup]',
            JSON.stringify({
                expectedLen: expected.length,
                textLen: text.length,
                equal: text.includes(expected),
                title,
                clamped: contentEl.exists() && contentEl.classes().includes('nue-text--clamped')
            })
        )
        expect(contentEl.exists(), '提示条正文应渲染').toBe(true)
        expect(text.includes(expected), '文案不得被截断').toBe(true)
        expect(contentEl.classes(), '不得加 clamped（会省略号截断）').not.toContain(
            'nue-text--clamped'
        )
        expect(title).toBe(t('component.passwordHint.title'))
        expect(wrapper.find('.nue-div--rule-hint').exists()).toBe(true)
    })

    it('清单管理器（实际 props + 实际文案）：title + 长警示文案完整、variant=warning', async () => {
        // `project-manager.vue` 的对话框体在 jsdom 下不渲染（nue-dialog 懒渲染/注册句柄未触发），
        // 故按**组件实际的 props 与文案**直挂 `RuleHint`，并另用源级断言核对该使用点的写法未变。
        const managerSource =
            Object.values(
                import.meta.glob<string>(
                    '/packages/presentation/project/components/dialogs/manager/project-manager.vue',
                    { query: '?raw', import: 'default', eager: true }
                )
            )[0] ?? ''
        expect(managerSource, '使用点源码应可读').not.toBe('')
        expect(managerSource, '使用点应以 content 传长文案（非截断）').toMatch(
            /:content="t\('dialog\.projectManager\.deleteWarning'\)"/
        )

        const wrapper = mount(RuleHint, {
            props: {
                icon: 'priority-2',
                title: t('dialog.projectManager.deleteReminder'),
                content: t('dialog.projectManager.deleteWarning'),
                variant: 'warning'
            },
            global: { components: NUE }
        })
        mounted.push(wrapper)
        await nextTick()

        const expected = t('dialog.projectManager.deleteWarning')
        const contentEl = wrapper.find('.nue-text--content')
        const text = contentEl.exists() ? ((contentEl.element as Element).textContent ?? '') : ''
        console.log(
            '[T663/probe151:manager]',
            JSON.stringify({
                variant: wrapper.find('.nue-div--rule-hint').attributes('data-variant'),
                title: wrapper.find('.nue-text--title').text(),
                expectedLen: expected.length,
                textLen: text.length,
                full: text.includes(expected)
            })
        )
        expect(wrapper.find('.nue-div--rule-hint').attributes('data-variant')).toBe('warning')
        expect(wrapper.find('.nue-text--title').text()).toBe(
            t('dialog.projectManager.deleteReminder')
        )
        expect(text.includes(expected), '长警示文案不得被截断').toBe(true)
    })
})