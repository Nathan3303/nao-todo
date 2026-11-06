import { describe, expect, it } from 'vite-plus/test'
import source from '../rule-hint.vue?raw'

/**
 * `T665` · 修 2 —— `RuleHint` 必须自带**换行保护**（超长无空格 token 不得撑破容器/溢出卡片）
 *
 * @description qa `T663` 源级取证：`rule-hint.vue` 与 `nue-ui` 的 `text.css` 均**无**
 *              `overflow-wrap` / `word-break`，而内容容器是 `flex: auto` 且无 `min-width: 0`
 *              ⇒ 长串（错误文本 / URL / 令牌）会把提示条撑宽或溢出。
 *              **只在本组件加保护**（⛔ 不改 `nue-ui` 包、不新增 token / 不另创样式体系）。
 *
 * ⚠️ 口径：本用例是**源级守卫**（改回归即红）；像素/观感归用户走查（jsdom 无布局引擎，不测宽度）。
 */

/** 取 `<style scoped>` 段（纯文本；注释保留不影响断言） */
const styleBlock = (raw: string): string => {
    const match = raw.match(/<style[^>]*>([\s\S]*?)<\/style>/)
    if (!match?.[1]) throw new Error('rule-hint.vue 缺少 <style> 段')
    return match[1]
}

/** 从某选择器起按花括号配平取出该规则体（含嵌套），返回 `{ body, rest }` */
const ruleBody = (css: string, selector: string): string => {
    const start = css.indexOf(selector)
    expect(start, `未找到规则 ${selector}`).toBeGreaterThanOrEqual(0)
    const open = css.indexOf('{', start)
    let depth = 0
    for (let i = open; i < css.length; i += 1) {
        if (css[i] === '{') depth += 1
        else if (css[i] === '}') {
            depth -= 1
            if (depth === 0) return css.slice(open + 1, i)
        }
    }
    throw new Error(`规则 ${selector} 花括号不配平`)
}

const normalize = (text: string): string => text.replace(/\s+/g, ' ')

const CSS = styleBlock(source)

describe('T665 修 2 · RuleHint 换行保护（源级）', () => {
    it('容器规则含 overflow-wrap: anywhere（超长 token 可断行）', () => {
        const body = normalize(ruleBody(CSS, '.nue-div--rule-hint {'))
        expect(body).toContain('overflow-wrap: anywhere')
    })

    it('容器与内容容器都置 min-width: 0（flex 子项默认 auto 会把卡片撑宽）', () => {
        const root = normalize(ruleBody(CSS, '.nue-div--rule-hint {'))
        expect(root).toContain('min-width: 0')
        const wrapper = normalize(ruleBody(CSS, '.nue-div--rule-hint__content-wrapper {'))
        expect(wrapper, '内容容器（flex: auto）必须允许收缩').toContain('min-width: 0')
    })

    it('正文文本自身也允许任意断行（.nue-text--content）', () => {
        const content = normalize(ruleBody(CSS, '.nue-text--content {'))
        expect(content).toContain('overflow-wrap: anywhere')
    })

    it('不得改动外部依赖（只在本组件内加规则，样式仍为 scoped）', () => {
        expect(source).toContain('<style scoped>')
        // ⛔ 不得出现 `:deep` 去改 nue-ui 内部（保护必须落在本组件自己的盒模型上）
        expect(normalize(CSS)).not.toContain(':deep')
    })
})