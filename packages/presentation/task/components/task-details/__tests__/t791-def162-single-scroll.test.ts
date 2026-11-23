// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'

/**
 * `T791` / `DEF-162` —— 变更历史对话框**只允许一层滚动**（源级守卫）
 *
 * 缺陷：`.task-history__detail` 曾有 `max-height: 6.5rem; overflow: auto` ⇒ 列表接近满时
 * 展开条目出现**第二层滚动条**（`T719` 实测：列表可视高 416px，`rows=4` 展开后
 * `scrollHeight 445 > 416`），滚轮落在展开区被内层吞掉。
 *
 * 修法（PM 裁定）：展开区**不加高度上限、不自滚**，内容随列表（`.task-history__list`）一起滚。
 * 本用例是它的**源级守卫**：任何人把 `max-height` / `overflow` 加回 `.task-history__detail`、
 * 或在别处新增滚动容器、或把注释写回「内滚」⇒ 立即变红（无需浏览器）。
 *
 * 几何侧的补充证据在 `t717-qa-history-feed-render.test.ts`（真 Chromium：
 * 只允许一个「真的在滚」的容器 = `.task-history__list`）。
 */

const SOURCE = readFileSync(new URL('../task-history-dialog.vue', import.meta.url), 'utf8')

interface CssRule {
    selector: string
    body: string
}

/** 合并所有 `<style>` 块（宿主级 + `scoped` 两段都算） */
const styleText = (): string => {
    const blocks = [...SOURCE.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(
        (match) => match[1] ?? ''
    )
    expect(blocks.length, '组件必须有 <style> 块').toBeGreaterThan(0)
    return blocks.join('\n')
}

/**
 * 极简 CSS 规则切分（只够本组件的扁平样式用）：按 `}` 切段，每段最后一个 `{` 前是选择器
 * （先剥掉注释）。`@media` 内的规则同样会被取到 —— 这正是想要的（⛔ 不许藏在媒体查询里）。
 */
const rules = (): CssRule[] => {
    const parsed: CssRule[] = []
    for (const segment of styleText().split('}')) {
        const brace = segment.lastIndexOf('{')
        if (brace < 0) continue
        const head = (segment.slice(0, brace).split(/[;{}]/).pop() ?? '').replace(
            /\/\*[\s\S]*?\*\//g,
            ''
        )
        parsed.push({ selector: head.trim(), body: segment.slice(brace + 1) })
    }
    return parsed
}

/** 选择器**完全等于** `selector` 的规则体（⛔ 不误命中 `.task-history__detail-row` 之类前缀相同的类） */
const ruleBodies = (selector: string): string[] =>
    rules()
        .filter((rule) => rule.selector === selector)
        .map((rule) => rule.body)

/** 滚动声明（`overflow` / `overflow-x` / `overflow-y` 且值含 `auto` 或 `scroll`；⛔ 不含 `overflow-wrap`） */
const scrollingDeclarations = (): Array<{ selector: string; declaration: string }> =>
    rules().flatMap((rule) =>
        (rule.body.match(/overflow(-[xy])?\s*:\s*[^;]+/g) ?? [])
            .filter((declaration) => /auto|scroll/.test(declaration))
            .map((declaration) => ({ selector: rule.selector, declaration: declaration.trim() }))
    )

describe('T791 / DEF-162 变更历史：单一滚动容器（源级守卫）', () => {
    it('① `.task-history__detail` 规则块内 ⛔ 不含 max-height / overflow（展开随列表滚）', () => {
        const bodies = ruleBodies('.task-history__detail')
        expect(bodies.length, '必须存在 `.task-history__detail` 规则块').toBe(1)
        const body = bodies[0]!
        // 变异自证：把 `max-height: 6.5rem; overflow: auto;` 加回 ⇒ 下面两条必红
        expect(body, `⛔ 展开区不得有高度上限（max-height）:\n${body}`).not.toMatch(/max-height/)
        expect(body, `⛔ 展开区不得设 overflow（会变成第二层滚动）:\n${body}`).not.toMatch(
            /overflow/
        )
    })

    it('② 全组件只有 1 条滚动声明，且属于 `.task-history__list`', () => {
        const declarations = scrollingDeclarations()
        expect(
            declarations.map((item) => item.selector),
            `只允许列表一个滚动容器（实测 ${JSON.stringify(declarations)}）`
        ).toEqual(['.task-history__list'])
        expect(declarations[0]!.declaration, '列表必须是 `overflow: auto`').toContain('auto')
    })

    it('③ 列表仍是唯一滚动容器的**宿主**：仍保留 max-height 上限（⛔ 不连带拆掉）', () => {
        const body = ruleBodies('.task-history__list')[0] ?? ''
        expect(body, '`.task-history__list` 必须有 max-height 上限').toMatch(
            /max-height\s*:\s*min\(/
        )
    })

    it('④ 源码注释里 ⛔ 不得再出现「内滚」（防止注释与实际行为相反）', () => {
        const comments = [...SOURCE.matchAll(/\/\*([\s\S]*?)\*\//g)].map((match) => match[1] ?? '')
        const offenders = comments.filter((comment) => comment.includes('内滚'))
        expect(offenders, `注释不得声称「内滚」：${JSON.stringify(offenders)}`).toEqual([])
    })
})