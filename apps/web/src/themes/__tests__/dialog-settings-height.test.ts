import { describe, expect, it } from 'vite-plus/test'

/**
 * T521-R3 窄屏设置对话框「内容区高度塌陷」源级守卫
 *
 * @description 缺陷：`themes/dialog.css` 的 ≤400px 通用贴底规则把对话框高度改为
 *              `fit-content`（自动高），它在 ≤445px 的 settings 定高块**之后**且同特异性
 *              ⇒ 覆盖 `height: 85%`；而 `.sd-panel { flex: 1; min-height: 0 }` 在自动高
 *              容器里分不到自由空间 ⇒ 面板高度 = 0（390px 真机「只剩 Tab、正文空白」）。
 *
 *              **为什么三轮门禁全绿却没拦住**：盒高塌陷依赖**真实布局**（flex 剩余空间分配 +
 *              自动高度解析），而 jsdom 没有布局引擎 —— `mount` 后的 DOM 结构、class、a11y
 *              断言全部通过，`getBoundingClientRect()` 恒返回 0（连正确实现也测不出高度）。
 *              ⇒ 只能做**源级守卫**：把「≤400 档的设置对话框必须是定高、且生效的最后一条
 *              height 不是 fit-content」钉死在 CSS 文本上；布局真值仍由真机/浏览器走查覆盖。
 *
 * @see docs/prds/2026-10-22-aside-drawer-sync-and-settings.md（AC3 五档宽度）
 */

const cssModules = import.meta.glob<string>('/apps/web/src/themes/dialog.css', {
    query: '?raw',
    import: 'default',
    eager: true
})
const dialogSfcModules = import.meta.glob<string>(
    '/apps/web/src/components/settings/dialog/index.vue',
    { query: '?raw', import: 'default', eager: true }
)

/** 断言命中且仅命中 1 个文件后返回源文本（防 glob 写错 ⇒ 恒真/恒假空转） */
const sourceOf = (modules: Record<string, string>): string => {
    const values = Object.values(modules)
    expect(values.length).toBe(1)
    return values[0]!
}

type MediaBlock = { condition: string; body: string; start: number }

/** 按源序解析所有 `@media` 块（花括号配对，允许嵌套规则） */
const mediaBlocks = (source: string): MediaBlock[] => {
    const blocks: MediaBlock[] = []
    const opener = /@media[^{]*\{/g
    let match: RegExpExecArray | null
    while ((match = opener.exec(source))) {
        const bodyStart = opener.lastIndex
        let depth = 1
        let index = bodyStart
        while (index < source.length && depth > 0) {
            if (source[index] === '{') depth += 1
            else if (source[index] === '}') depth -= 1
            index += 1
        }
        blocks.push({
            condition: match[0].slice('@media'.length, -1).trim(),
            body: source.slice(bodyStart, index - 1),
            start: match.index
        })
    }
    return blocks
}

/** 选取 `max-width: <400|445>px` 的块，并按源序返回 */
const widthBlocks = (source: string, width: 400 | 445): MediaBlock[] =>
    mediaBlocks(source).filter((block) =>
        new RegExp(`max-width:\\s*${width}px`).test(block.condition)
    )

/** 取块内匹配某选择器的规则体（`selector { ... }`，允许一行/多行） */
const ruleBodies = (css: string, selectorPattern: RegExp): string[] => {
    const rules: string[] = []
    const rule = /([^{}]+)\{([^{}]*)\}/g
    let match: RegExpExecArray | null
    while ((match = rule.exec(css))) {
        if (selectorPattern.test(match[1]!.trim())) rules.push(match[2]!)
    }
    return rules
}

/** 依源序取「最后一条生效的 height 声明值」（同特异性下后者胜；只取 height，不含 min/max-height） */
const lastHeight = (bodies: string[]): string | null => {
    let value: string | null = null
    for (const body of bodies) {
        for (const declaration of body.split(';')) {
            const [property, ...rest] = declaration.split(':')
            if (!property || property.trim() !== 'height') continue
            value = rest.join(':').trim()
        }
    }
    return value
}

describe('T521-R3 窄屏设置对话框定高（源级守卫）', () => {
    it('通用 ≤400 贴底规则仍在（T519 未被删改：fit-content + margin-top:auto + 安全区留白）', () => {
        const source = sourceOf(cssModules)
        const blocks = widthBlocks(source, 400)
        expect(blocks.length).toBeGreaterThanOrEqual(1)

        const generic = blocks.find((block) => /\.nue-dialog,/.test(block.body))
        expect(generic, '通用 .nue-dialog ≤400 贴底规则缺失').toBeTruthy()
        expect(generic!.body).toMatch(/height:\s*fit-content/)
        expect(generic!.body).toContain('margin-top: auto')
        expect(generic!.body).toContain('env(safe-area-inset-bottom, 0px)')
    })

    it('≤400 档设置对话框其后有定高规则，且生效的最后一条 height 不是 fit-content', () => {
        const source = sourceOf(cssModules)
        const blocks = widthBlocks(source, 400)
        const generic = blocks.find((block) => /\.nue-dialog,/.test(block.body))
        expect(generic).toBeTruthy()

        // 只认「命中 `.nue-dialog.nue-dialog--settings` 选择器」的块
        const settingsBlocks = blocks.filter((block) =>
            ruleBodies(block.body, /^\.nue-dialog\.nue-dialog--settings$/).some((body) =>
                /height:\s*[^;]+;/.test(body)
            )
        )
        expect(settingsBlocks.length).toBeGreaterThanOrEqual(1)

        const settings = settingsBlocks[settingsBlocks.length - 1]!
        // 必须位于通用贴底块之后（同特异性靠后者胜 ⇒ 这是修复能生效的唯一形态）
        expect(settings.start).toBeGreaterThan(generic!.start)

        const height = lastHeight(
            settingsBlocks.flatMap((block) =>
                ruleBodies(block.body, /^\.nue-dialog\.nue-dialog--settings$/)
            )
        )
        expect(height).not.toBeNull()
        expect(height).not.toMatch(/fit-content/)
        expect(height).toMatch(/85%/)
    })

    it('静态结构：窄屏面板按内容起步（flex-basis: auto）+ 定高容器链，桌面基础样式不动', () => {
        const source = sourceOf(dialogSfcModules)

        // 定高容器链：settings 外框是 flex 列 + main 可收缩（面板才有空间可分配）
        expect(source).toMatch(/\.nue-dialog--settings\s*\{[^}]*display:\s*flex/)
        expect(source).toMatch(/\.nue-dialog--settings\s*\{[^}]*flex-direction:\s*column/)
        expect(source).toMatch(/\.nue-dialog--settings\s*>\s*\.nue-dialog__main\s*\{[^}]*flex:\s*1/)
        expect(source).toMatch(
            /\.nue-dialog--settings\s*>\s*\.nue-dialog__main\s*\{[^}]*min-height:\s*0/
        )

        // 桌面基础面板不变（flex: 1 + 可滚动），窄屏另有 flex-basis: auto 兜底
        expect(source).toMatch(/\.sd-panel\s*\{[^}]*flex:\s*1;/)
        expect(source).toMatch(/\.sd-panel\s*\{[^}]*min-height:\s*0;/)
        expect(source).toMatch(/\.sd-panel\s*\{[^}]*overflow:\s*auto;/)
        expect(source).toMatch(/\.is-narrow\s+\.sd-panel\s*\{[^}]*flex:\s*1\s+1\s+auto;/)
    })
})