import { describe, expect, it } from 'vite-plus/test'

/**
 * DEF-79 / T519：Web 端移动浏览器「视口基混用 + 无安全区」源级防回归
 * @description 手法沿用 `button-overrides.test.ts`（`?raw` 源文本断言，不新建测试基建）。
 *              覆盖 PRD AC6 四项：① viewport meta 含 `viewport-fit=cover`；
 *              ② 安全区补丁四向 `env(safe-area-inset-*, 0px)` 且已进主题入口；
 *              ③ 主题入口 / 补丁内无含滚动条宽度的视口单位、无裸静态视口高度基；
 *              ④ 全仓 `apps/web/src` 静态视口高度残留 = 0。
 *              另附视口基归一与降级兜底的源级断言（AC2 / 不变量 1、4）。
 *
 * 口径说明：静态视口高度白名单 = **空**。降级兜底来自主题 reset 的 `.nue-html` 声明
 * （`nue-ui-theme-shadlike`，位于 `node_modules`，不在 `apps/web/src` 内）⇒ 仓内无需
 * 再写兜底声明行；如将来确需在仓内写兜底，必须在 `STATIC_HEIGHT_ALLOWLIST` 显式列明。
 */

/** 目标字符串拆写：避免测试自身被全仓扫描命中（自指假阳性） */
const STATIC_VIEWPORT_HEIGHT = ['100', 'vh'].join('')
const SCROLLBAR_WIDTH_VIEWPORT = ['100', 'dvw'].join('')
/** 静态视口高度白名单（本批为空，见文件头口径说明） */
const STATIC_HEIGHT_ALLOWLIST: readonly string[] = []

const webIndexHtmlModules = import.meta.glob<string>('/apps/web/index.html', {
    query: '?raw',
    import: 'default',
    eager: true
})
const themesIndexModules = import.meta.glob<string>('/apps/web/src/themes/index.ts', {
    query: '?raw',
    import: 'default',
    eager: true
})
const variablesModules = import.meta.glob<string>('/apps/web/src/themes/variables.css', {
    query: '?raw',
    import: 'default',
    eager: true
})
const safeAreaModules = import.meta.glob<string>('/apps/web/src/themes/safe-area.css', {
    query: '?raw',
    import: 'default',
    eager: true
})
const dialogModules = import.meta.glob<string>('/apps/web/src/themes/dialog.css', {
    query: '?raw',
    import: 'default',
    eager: true
})
const initialPullGateModules = import.meta.glob<string>(
    '/apps/web/src/components/initial-pull-gate.vue',
    { query: '?raw', import: 'default', eager: true }
)
const indexViewModules = import.meta.glob<string>('/apps/web/src/views/index/index.vue', {
    query: '?raw',
    import: 'default',
    eager: true
})
/** 全仓 Web 源码（含测试源文本；目标字符串已拆写 ⇒ 不自指） */
const webSourceModules = import.meta.glob<string>('/apps/web/src/**/*.{vue,css,ts}', {
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

const countOccurrences = (haystack: string, needle: string): number =>
    haystack.split(needle).length - 1

const SAFE_AREA_SIDES = ['top', 'right', 'bottom', 'left'] as const

/** env(safe-area-inset-<side>, 0px)：允许格式化带来的空白差异，但兜底值必须是 0px */
const safeAreaInsetCount = (css: string, side: (typeof SAFE_AREA_SIDES)[number]): number =>
    (css.match(new RegExp(`env\\(\\s*safe-area-inset-${side}\\s*,\\s*0px\\s*\\)`, 'g')) ?? [])
        .length

describe('DEF-79 安全区与视口基线', () => {
    it('AC6①：viewport meta 含 viewport-fit=cover（否则 env() 恒为 0）', () => {
        const viewportMeta =
            sourceOf(webIndexHtmlModules).match(/<meta[^>]*name="viewport"[^>]*>/)?.[0] ?? ''

        expect(viewportMeta).not.toBe('')
        expect(viewportMeta).toContain('width=device-width')
        expect(viewportMeta).toContain('viewport-fit=cover')
    })

    it('AC6②：安全区补丁四向 env(..., 0px) 且已由主题入口引入', () => {
        const css = sourceOf(safeAreaModules)
        for (const side of SAFE_AREA_SIDES) {
            expect(
                safeAreaInsetCount(css, side),
                `缺 ${side} 向内缩或未带 0px 兜底`
            ).toBeGreaterThanOrEqual(1)
        }
        // 落在真实选择器上（外壳 + 覆盖层），不是只在注释里出现
        expect(css).toContain('html.nue-html body')
        expect(css).toContain('.nue-overlay:not(.nue-overlay--transparent)')

        expect(sourceOf(themesIndexModules)).toMatch(/import\s+['"]\.\/safe-area\.css['"]/)
    })

    it('AC6③：主题入口与补丁内无含滚动条宽度的视口单位、无裸静态视口高度基', () => {
        const sources: [string, string][] = [
            ['themes/index.ts', sourceOf(themesIndexModules)],
            ['themes/variables.css', sourceOf(variablesModules)],
            ['themes/safe-area.css', sourceOf(safeAreaModules)],
            ['themes/dialog.css', sourceOf(dialogModules)]
        ]

        for (const [name, source] of sources) {
            expect(countOccurrences(source, SCROLLBAR_WIDTH_VIEWPORT), `${name} 含 dvw`).toBe(0)
            expect(countOccurrences(source, STATIC_VIEWPORT_HEIGHT), `${name} 含 vh`).toBe(0)
        }
    })

    it('AC6④：全仓 apps/web/src 静态视口高度残留 = 0（白名单显式为空）', () => {
        const entries = Object.entries(webSourceModules)
        // 防 glob 空转：命中文件数必须为正（当前约 360+）
        expect(entries.length).toBeGreaterThan(100)

        const residual = entries
            .filter(([, source]) => countOccurrences(source, STATIC_VIEWPORT_HEIGHT) > 0)
            .map(([file]) => file)
            .filter((file) => !STATIC_HEIGHT_ALLOWLIST.some((allowed) => file.includes(allowed)))

        expect(residual).toEqual([])
    })

    it('视口基归一：html 取动态视口、body 取 100%，且降级时恢复页面滚动', () => {
        const css = sourceOf(variablesModules)

        expect(css).toMatch(/html\.nue-html\s*\{[^}]*height:\s*100dvh/)
        expect(css).toMatch(/body\s*\{[^}]*height:\s*100%/)
        expect(css).toMatch(/@supports\s+not\s*\(height:\s*100dvh\)/)
        expect(css).toMatch(/@supports\s+not\s*\(height:\s*100dvh\)\s*\{[^}]*overflow:\s*auto/)
    })

    it('加载态高度相对父级（不再以视口高度为基线）', () => {
        expect(sourceOf(initialPullGateModules)).toContain('height="100%"')
        expect(sourceOf(indexViewModules)).toContain('height="100%"')
    })
})