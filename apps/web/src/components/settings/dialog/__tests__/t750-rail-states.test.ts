// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'

/**
 * T750 / Issue #360 · 左栏导航四态 + 间距台阶（AC1 / AC4 / AC7 / AC12）
 *
 * 本文件守两件事（均为**源级**断言：jsdom 不注入 SFC 样式、无布局引擎）：
 * - **AC1 左栏无左侧竖线**：激活态只靠「深填充 + 字重 + `aria-selected`」三通道，⛔ 任何
 *   `box-shadow: inset …` / `border-left` 指示条（旧版 `inset 2px 0 0` 即用户直报的那条竖线）。
 *   四态取值逐条对齐 `nue-ui@1.15.3` + `nue-ui-theme-shadlike` 的 `.nue-link--route` 与本仓
 *   `themes/link.css` 的焦点环（设计稿 §3a）：透明 → hover `-200` → 激活 `-900` 底 + `-0` 字 + 600
 *   → focus 环 `-600` + offset 2。
 * - **AC4 间距台阶 L0–L6**：每层一个唯一来源，`calc()` 只允许出现在「容器已带行 gap」的两处
 *   （`.sd-group__head` / `.sd-subblock`），解析后的实际间距必须等于目标值。
 *
 * a11y 不降级（DOM / `role=tab` / `aria-selected` / `↑↓`·`Home`·`End`）由
 * `settings-ia.test.ts` 的「AC7 a11y」组**逐条运行时**覆盖（本单零改动 ⇒ 该组保持全绿）；
 * 本文件只补「语义钩子仍在模板里」的源级守卫，防止视觉改写顺手删掉键盘处理。
 *
 * 真机几何（四态配色 / 行高 / 左轴线 / 块间距）由真实 Chromium 探针实测，见回执。
 * @see docs/designs/360-settings-polish.md（§3a 左栏四态 / §3d 间距台阶）
 * @see docs/prds/2026-11-22-settings-polish.md（AC1 / AC4）
 */

const DIALOG_PATH = '/apps/web/src/components/settings/dialog/index.vue'

const settingsModules = import.meta.glob<string>(
    '/apps/web/src/components/settings/**/*.{vue,ts}',
    {
        query: '?raw',
        import: 'default',
        eager: true
    }
)

/** 设置域全部源码（排除用例自身） */
const settingsSources = (): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const [path, source] of Object.entries(settingsModules)) {
        if (path.includes('/__tests__/')) continue
        out[path] = source
    }
    return out
}

/** 去注释：`?raw` 读到的是源码文本，注释里的旧选择器/旧数值会污染正则扫描 */
const stripComments = (source: string): string =>
    source.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

const dialogNoComments = stripComments(settingsModules[DIALOG_PATH] ?? '')

const dialogStyle = ((): string => {
    const start = dialogNoComments.indexOf('<style>')
    const end = dialogNoComments.lastIndexOf('</style>')
    return start < 0 || end < 0 ? '' : dialogNoComments.slice(start, end)
})()

const dialogTemplate = ((): string => {
    const start = dialogNoComments.indexOf('<template>')
    const end = dialogNoComments.indexOf('</template>')
    return start < 0 || end < 0 ? '' : dialogNoComments.slice(start, end)
})()

/** 取指定选择器的**首个**规则体（选择器逐字匹配 `选择器 {`） */
const ruleBody = (selector: string, source: string = dialogStyle): string => {
    const start = source.indexOf(`${selector} {`)
    if (start < 0) return ''
    const open = start + selector.length + 2
    return source.slice(open, source.indexOf('}', open))
}

/** 取某个声明块的 `属性: 值`（多值缩写原样返回，未声明 ⇒ ''） */
const declaration = (selector: string, property: string): string => {
    const body = ruleBody(selector)
    const match = new RegExp(`(?:^|;|\\s)${property}:\\s*([^;]+)`).exec(body)
    return (match?.[1] ?? '').trim()
}

/**
 * token → px（取自 `nue-ui-theme-shadlike/dist/global/variables.css`，light 档）
 * @description 只列本单用到的档位；遇到未知 token 直接抛 ⇒ 防止「写错 token 名但断言仍绿」
 */
const TOKEN_PX: Record<string, number> = {
    '--nue-gap-2xs': 4,
    '--nue-gap-xs': 8,
    '--nue-gap-sm': 12,
    '--nue-gap-lg': 24,
    '--nue-padding-2xs': 4,
    '--nue-padding-xs': 8,
    '--nue-padding-sm': 12,
    '--nue-padding-df': 16,
    '--nue-padding-md': 20,
    '--nue-box-size-md': 40
}

/** 解析 `var(--x)` / `calc(var(--a) - var(--b))` / 裸 `Npx` / 裸 `Nrem` 为 px 数值 */
const toPx = (value: string): number => {
    const expr = value.trim()
    const calc = /^calc\((.*)\)$/.exec(expr)
    if (calc) {
        const [left, right] = calc[1]!.split(/\s+-\s+/)
        return toPx(left!) - toPx(right!)
    }
    const varRef = /^var\((--[a-z0-9-]+)\)$/.exec(expr)
    if (varRef) {
        const px = TOKEN_PX[varRef[1]!]
        if (px === undefined) throw new Error(`未登记的 token：${varRef[1]}`)
        return px
    }
    const px = /^([\d.]+)px$/.exec(expr)
    if (px) return Number(px[1])
    const rem = /^([\d.]+)rem$/.exec(expr)
    if (rem) return Number(rem[1]) * 16
    throw new Error(`无法解析的长度值：${expr}`)
}

describe('AC1 左栏激活态：无左侧竖线（源级）', () => {
    it('设置域内⛔ 不存在 box-shadow / 左侧指示线声明（旧版 `inset 2px 0 0` 那一条竖线已删）', () => {
        const offenders: string[] = []
        for (const [path, source] of Object.entries(settingsSources())) {
            const code = stripComments(source)
            for (const match of code.matchAll(
                /(box-shadow|border-left|border-inline-start)\s*:/g
            )) {
                offenders.push(`${path}: ${match[0]}`)
            }
            expect(code, `${path} 仍含 inset 阴影`).not.toMatch(/box-shadow:[^;]*inset/)
        }
        expect(
            offenders,
            `左栏/面板仍在用「线 / 阴影」表达状态：\n${offenders.join('\n')}`
        ).toEqual([])
    })

    it('激活态 = 深填充 + 字重 + 白字，且不声明任何 shadow / 边框', () => {
        const active = ruleBody('.sd-tab.is-active')
        expect(active).not.toBe('')
        expect(active).not.toContain('box-shadow')
        expect(active).not.toContain('border')
        expect(declaration('.sd-tab.is-active', 'background')).toBe('var(--nue-primary-color-900)')
        expect(declaration('.sd-tab.is-active', 'color')).toBe('var(--nue-primary-color-0)')
        expect(declaration('.sd-tab.is-active', 'font-weight')).toBe('600')
    })

    it('四态取值与 `nue-link--route` 既有口径一致（未激活 / hover / focus）', () => {
        const base = ruleBody('.sd-tab')
        // 未激活：透明底、文字 -800、无描边、6px 圆角
        expect(declaration('.sd-tab', 'background')).toBe('transparent')
        expect(declaration('.sd-tab', 'color')).toBe('var(--nue-primary-text-color)')
        expect(declaration('.sd-tab', 'border')).toBe('0')
        expect(declaration('.sd-tab', 'border-radius')).toBe('var(--nue-primary-radius)')
        expect(base).not.toContain('outline')
        // hover：只换底（-200），⛔ 不改字色（不靠变色传达 hover）
        expect(declaration('.sd-tab:hover', 'background')).toBe('var(--nue-primary-color-200)')
        expect(declaration('.sd-tab:hover', 'color')).toBe('')
        // focus-visible：环 -600 + offset 2（与本仓 `themes/link.css` 的 `.nue-link` 同口径）
        expect(declaration('.sd-tab:focus-visible', 'outline')).toBe(
            '2px solid var(--nue-primary-color-600)'
        )
        expect(declaration('.sd-tab:focus-visible', 'outline-offset')).toBe('2px')
    })

    it('行级命中区 ≥40px 且不用固定 height（英文长名可长高，AC8/AC12）', () => {
        expect(declaration('.sd-tab', 'min-height')).toBe('var(--nue-box-size-md)')
        expect(toPx(declaration('.sd-tab', 'min-height'))).toBeGreaterThanOrEqual(40)
        expect(ruleBody('.sd-tab')).not.toMatch(/(?:^|;|\s)height:/)
    })

    it('语义钩子逐字仍在（视觉改写不得顺手删掉 tablist / tab / 键盘处理）', () => {
        for (const needle of [
            'role="tablist"',
            'aria-orientation="vertical"',
            'role="tab"',
            ':aria-selected="category.id === activeCategoryId"',
            ':aria-controls="panelIdOf(category.id)"',
            '@keydown="onTabKeydown($event, index)"'
        ]) {
            expect(dialogTemplate, `模板缺 ${needle}`).toContain(needle)
        }
        // `↑↓` / `Home` / `End` 四个键的处理逐字仍在
        for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
            expect(dialogNoComments, `键盘切换缺 ${key}`).toContain(`'${key}'`)
        }
    })
})

describe('AC4 间距台阶 L0–L6：每层一个唯一来源（源级）', () => {
    it('L0 对话框外边距：面板自身 ⛔ 无 padding（旧版 12/20/24/40 四边叠在 16 之上已删）', () => {
        expect(declaration('.sd-panel', 'padding')).toBe('')
        expect(declaration('.sd-panel', 'padding-inline')).toBe('')
        expect(declaration('.sd-panel', 'padding-block')).toBe('')
        expect(declaration('.sd-body', 'padding')).toBe('')
        expect(declaration('.sd-cat', 'padding')).toBe('')
    })

    it('L1 栏间 = 20（`.sd-tabs` 的 `padding-inline-end` 唯一持有）', () => {
        expect(toPx(declaration('.sd-tabs', 'padding-inline-end'))).toBe(20)
        expect(declaration('.sd-tabs', 'padding-old')).toBe('')
    })

    it('L2 块↔块 = 24（`.sd-cat` gap 唯一持有；危险区不再自带 margin-top）', () => {
        expect(toPx(declaration('.sd-cat', 'gap'))).toBe(24)
        expect(declaration('.sd-group--danger', 'margin-top')).toBe('')
        expect(declaration('.sd-group--danger', 'margin')).toBe('')
    })

    it('L3 组头↔首行 = 16、组头内 标题↔说明 = 4', () => {
        const headGap = toPx(declaration('.sd-group', 'gap'))
        const headMargin = toPx(declaration('.sd-group__head', 'margin-bottom'))
        expect(headMargin + headGap).toBe(16)
        expect(toPx(declaration('.sd-group__head', 'gap'))).toBe(4)
    })

    it('L4 行↔行 = 8（`.sd-group` gap 唯一持有；行自身 ⛔ padding-block / padding-inline）', () => {
        expect(toPx(declaration('.sd-group', 'gap'))).toBe(8)
        expect(declaration('.sd-row', 'padding')).toBe('')
        expect(declaration('.sd-row', 'padding-block')).toBe('')
        expect(declaration('.sd-row', 'padding-inline')).toBe('')
    })

    it('L5 行内：横向 8 / 纵向 4（⛔ 无 `2px` 字面值）', () => {
        expect(toPx(declaration('.sd-row', 'gap'))).toBe(8)
        expect(toPx(declaration('.sd-row__text', 'gap'))).toBe(4)
    })

    it('L6 + 块内水平内缩：`.sd-group` 的 `padding-inline` 是横轴唯一来源（12）', () => {
        expect(toPx(declaration('.sd-group', 'padding-inline'))).toBe(12)
        // 组头与行不再各自内缩（旧版与面板的 20 叠成三层）
        expect(declaration('.sd-group__head', 'padding-inline')).toBe('')
        expect(declaration('.sd-row', 'padding-inline')).toBe('')
        // 密码分区（T752 B 方案）：块 ⛔ 无底色 / 无内边距 / 无圆角 ⇒ 横轴内缩仍只由 `.sd-group` 承担
        expect(ruleBody('.sd-password__body'), '密码分区不再有块级规则').toBe('')
    })

    it('calc() 只出现在「容器已带行 gap」的两处（组头 / 子块）', () => {
        // T754：旧 `.sd-danger-row` 的负内缩 calc 随「改库按钮」一并删除 ⇒ 4 → 3
        // （剩：顶栏子块 / 组头 / 折叠行开关 三处负内缩或补齐）
        const calcs = [...dialogStyle.matchAll(/calc\(/g)]
        expect(calcs.length, 'calc 数量变化请同步本用例与设计稿 §3d').toBe(3)
        for (const selector of ['.sd-group__head', '.sd-subblock']) {
            expect(
                declaration(selector, 'margin-top') + declaration(selector, 'margin-bottom')
            ).toContain('calc(')
        }
    })

    it('组内子块间距实际 = 24（子块 margin + 所在 .sd-group 的行 gap）', () => {
        const subblock = toPx(declaration('.sd-subblock', 'margin-top'))
        expect(subblock + toPx(declaration('.sd-group', 'gap'))).toBe(24)
    })

    it('稿件点名的字面值绝迹（2.75rem / 2rem / 0.375rem / 2.5rem / 1rem 全部换 token）', () => {
        for (const literal of ['2.75rem', '2rem', '0.375rem', '2.5rem', '1rem']) {
            expect(dialogStyle, `左栏/面板样式仍有字面值 ${literal}`).not.toContain(literal)
        }
        // 间距类声明一律不写裸长度（`outline: 2px` 这类非间距声明不在本判据内）
        const spacingLiterals = [
            ...dialogStyle.matchAll(
                /^\s*(?:gap|row-gap|column-gap|padding|padding-[a-z]+|margin|margin-[a-z]+):\s*[^;]*\b\d[\d.]*(?:px|rem)\b/gm
            )
        ].map((match) => match[0].trim())
        expect(spacingLiterals, `仍有非 token 间距值：\n${spacingLiterals.join('\n')}`).toEqual([])
        // 全设置域：非 token 的字面值清点（0 条）
        const offenders: string[] = []
        for (const [path, source] of Object.entries(settingsSources())) {
            const style = stripComments(source)
            const styleStart = style.indexOf('<style')
            if (styleStart < 0) continue
            const styleBody = style.slice(styleStart)
            for (const literal of ['2.75rem', '2rem', '0.375rem', '2.5rem']) {
                // 词边界：避免 `32rem` / `12.5rem` 这类更大数值的误判
                const pattern = new RegExp(`(?<![\\d.])${literal.replace('.', '\\.')}\\b`)
                if (pattern.test(styleBody)) offenders.push(`${path}: ${literal}`)
            }
        }
        expect(offenders, `仍有非 token 间距字面值：\n${offenders.join('\n')}`).toEqual([])
    })

    it('窄屏不分叉：无 `.is-narrow` 下的 padding / gap 副本（旧版三条覆盖 + 2rem 已删）', () => {
        const narrowRules = [...dialogStyle.matchAll(/([^\n{}]*\.is-narrow[^\n{}]*)\{/g)].map(
            (match) => match[1]!.trim()
        )
        expect(narrowRules.length).toBeGreaterThan(0)
        for (const selector of narrowRules) {
            for (const part of selector.split(',')) {
                expect(part.trim(), `窄屏选择器未挂在 .sd-body 上：${selector}`).toMatch(
                    /^\.sd-body/
                )
            }
        }
        for (const forbidden of [
            '.is-narrow .sd-row',
            '.is-narrow .sd-cat',
            '.is-narrow .sd-group__head'
        ]) {
            expect(dialogStyle, `窄屏仍有 ${forbidden} 覆盖副本`).not.toContain(forbidden)
        }
        expect(ruleBody('.sd-body.is-narrow .sd-panel')).not.toContain('padding')
    })
})