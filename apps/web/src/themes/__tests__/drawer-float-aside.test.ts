import { describe, expect, it } from 'vite-plus/test'

/**
 * T731 补丁单 3：`theme="float-aside"` 抽屉「隐藏空标题栏」规则的源级守卫
 * @description 事故链（`T731` → `T732` 复验）：`theme="float-aside"` 的隐藏 header 规则原先只在
 *              **已删除的死组件** `components/app/aside/float-aside.vue` 的全局 `<style>` 里，
 *              删死组件时被连带删除，而该主题仍有 2 个存活消费方 ⇒ 两个抽屉多出「空标题栏 + 关闭按钮」。
 *              规则已收敛到 `themes/drawer.css`（web / desktop 两端 `main` 都 `import './themes'`）。
 *              本文件的判据是**构建后 grep 之外的门禁**：删规则、删消费方主题、或把载体文件从
 *              主题入口摘掉，任一发生都会红。
 *
 * 手法沿用 `safe-area.test.ts`（`?raw` 源文本断言，不新建测试基建）。
 * ⛔ 刻意不用 `toContain('float-aside')` 这类宽判据：必须命中**选择器 + 声明都完整**的规则块，
 *    否则注释里的字样、或改坏成 `display: block` 都会静默通过。
 */

const drawerModules = import.meta.glob<string>('/apps/web/src/themes/drawer.css', {
    query: '?raw',
    import: 'default',
    eager: true
})
const themesIndexModules = import.meta.glob<string>('/apps/web/src/themes/index.ts', {
    query: '?raw',
    import: 'default',
    eager: true
})

/** 2 个存活消费方：`theme="float-aside"` 的抽屉宿主 */
const CONSUMER_PATHS = [
    '/packages/presentation/task/components/multi-select/task-multi-select-panel.vue',
    '/packages/presentation/task/components/task-details/float-details.vue'
] as const

const consumerModules = import.meta.glob<string>(
    [
        '/packages/presentation/task/components/multi-select/task-multi-select-panel.vue',
        '/packages/presentation/task/components/task-details/float-details.vue'
    ],
    { query: '?raw', import: 'default', eager: true }
)

/** 断言 glob 命中且仅命中 1 个文件后返回其源文本（防「glob 模式写错 ⇒ 恒真/恒假」空转） */
const sourceOf = (modules: Record<string, string>, label: string): string => {
    const values = Object.values(modules)
    expect(values.length, `${label}：glob 命中数`).toBe(1)
    return values[0]!
}

interface CssRule {
    selector: string
    body: string
}

/**
 * 取出 CSS 里的全部规则块（选择器 + 声明体）
 * @description 先剥注释，避免「注释里写着 `display: none`」冒充真规则；再按 `{…}` 配对切块。
 *              `drawer.css` 目前是扁平结构（无嵌套 / 无 `@media`），此解析足够且不会误伤。
 */
const parseRules = (css: string): CssRule[] => {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
    return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
        selector: match[1]!.trim(),
        body: match[2]!
    }))
}

/**
 * 从 `*.vue` 源文本里取「`<nue-drawer>` 开标签上的 theme 令牌」
 * @description 语义化匹配（`theme="a,b"` 也算用到 `a`），但仍要求 theme 写在 `nue-drawer` 开标签上，
 *              避免「页面别处出现 `float-aside` 字样」冒充消费方。
 */
const drawerThemeTokens = (source: string): string[] => {
    const openTags = source.match(/<nue-drawer\b[^>]*>/g) ?? []
    return openTags.flatMap((tag) => {
        const theme = tag.match(/\btheme\s*=\s*"([^"]*)"/)?.[1]
        return theme ? theme.split(/[,\s]+/).filter(Boolean) : []
    })
}

describe('T731 §float-aside 抽屉隐藏空标题栏（防「删死组件带走活规则」再犯）', () => {
    it('drawer.css 含完整规则：`.nue-drawer--float-aside` 的 `.nue-drawer__header` 被 `display: none`', () => {
        const rules = parseRules(sourceOf(drawerModules, 'themes/drawer.css'))

        const matches = rules.filter(
            (rule) =>
                rule.selector.includes('.nue-drawer--float-aside') &&
                rule.selector.includes('.nue-drawer__header') &&
                /(?:^|;)\s*display\s*:\s*none\s*(?:;|$)/.test(rule.body)
        )

        expect(
            matches.length,
            `未命中「选择器含 float-aside + header 且声明 display: none」的完整规则块；实测规则：${JSON.stringify(rules, null, 1)}`
        ).toBeGreaterThanOrEqual(1)
    })

    it('载体文件仍由主题入口引入（防「规则还在但没被加载」）', () => {
        expect(sourceOf(themesIndexModules, 'themes/index.ts')).toMatch(
            /import\s+['"]\.\/drawer\.css['"]/
        )
    })

    it('2 个消费方仍在 `<nue-drawer>` 上使用 `theme="float-aside"`（防删消费方后规则变成死样式）', () => {
        const entries = Object.entries(consumerModules)
        expect(entries.length, '消费方 glob 命中数').toBe(CONSUMER_PATHS.length)

        for (const [file, source] of entries) {
            expect(
                drawerThemeTokens(source),
                `${file}：<nue-drawer> 的 theme 未含 float-aside（规则会变成死样式；若确实迁移了主题，请同步删除本用例与 drawer.css 规则）`
            ).toContain('float-aside')
        }
    })
})