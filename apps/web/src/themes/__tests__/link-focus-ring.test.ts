import { describe, expect, it } from 'vite-plus/test'

/**
 * T630 S2（`DEF-116` 规避回收配套）：`.nue-link` 焦点环集中到项目主题层
 * @description 上游 `nue-ui` 1.15.3 的 `nue-link` 无任何 `:focus-visible` 规则
 *              （shadlike / glass 两套主题 `link.css` 均 0 命中）⇒ 回退包装件后若不补，键盘用户会丢失焦点环（违反 R-C「可访问性只增不减」）。
 *              落点固定为 `apps/web/src/themes/link.css`（`@/themes` 同时被 web 与
 *              desktop renderer 引入 ⇒ 一处覆盖两端），禁止每处调用点各写一份。
 *
 *              口径：jsdom 不计算 `:focus-visible`（无级联、伪类不匹配）⇒ 只能在源级断言，
 *              视觉结果由用户走查项（AC4③）覆盖。手法沿用 `button-overrides.test.ts` 的
 *              `?raw` glob + `sourceOf()`（命中且仅命中 1 个文件后才断言，防 glob 写错恒真）。
 */

const linkCssModules = import.meta.glob('/apps/web/src/themes/link.css', {
    query: '?raw',
    import: 'default',
    eager: true
})

/** 断言命中且仅命中 1 个文件后返回其源文本（防「glob 模式写错 ⇒ 恒真/恒假」空转） */
const sourceOf = (modules: Record<string, string>): string => {
    const values = Object.values(modules)
    expect(values.length).toBe(1)
    return values[0]!
}

describe('T630 S2 · .nue-link 焦点环集中到主题层', () => {
    it('themes/link.css 含 .nue-link:focus-visible 且声明与既有口径逐字一致', () => {
        const css = sourceOf(linkCssModules)

        const ruleStart = css.indexOf('.nue-link:focus-visible')
        expect(ruleStart).toBeGreaterThanOrEqual(0)

        // 取该规则块（选择器之后的第一对花括号），确保两条声明都落在块内而非文件别处
        const blockOpen = css.indexOf('{', ruleStart)
        const blockClose = css.indexOf('}', blockOpen)
        expect(blockOpen).toBeGreaterThan(ruleStart)
        expect(blockClose).toBeGreaterThan(blockOpen)
        const rule = css.slice(ruleStart, blockClose)

        expect(rule).toContain('outline: 2px solid var(--nue-primary-color-600)')
        expect(rule).toContain('outline-offset: 2px')
    })
})