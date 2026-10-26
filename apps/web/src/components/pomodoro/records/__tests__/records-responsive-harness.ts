/**
 * T549 记录页窄屏用例公共夹具（**非测试文件**，被 `__tests__/*.test.ts` 引用）
 *
 * 为什么需要它：jsdom **没有布局引擎** —— `getBoundingClientRect()` 恒为 0、
 * `scrollHeight`/`clientHeight` 恒为 0、`@media` 不参与层叠（`getComputedStyle` 读不到）。
 * ⇒ 「可滚动 / 无横向溢出 / 首屏可见 / 点击区 ≥40px」这类**几何真值**无法用 DOM 几何断言，
 *    只能对 **CSS 源码做层叠推演**（按 360/320/390/1280 计算生效值），几何真值仍归真机走查。
 *    先例与判定口径：`apps/web/src/themes/__tests__/dialog-settings-height.test.ts`（T521-R3）。
 *
 * 本夹具提供：
 * 1) `styleTextOf` —— 抽 SFC `<style>` 文本（去注释）；
 * 2) `parseCssRules` —— 解析（含 CSS 嵌套 `&`、`@media` 嵌套）为 `{ selectors, decls, media }` 规则表；
 * 3) `effectiveDecls` / `effectiveValue` —— 按目标选择器末段 + 视口宽度求「生效声明」（源序后者胜）；
 * 4) `setViewport` —— 同时驱动 `innerWidth` 与 `matchMedia`，**兼容 CSS 驱动与 JS 驱动的窄屏切换**；
 * 5) `stubResizeObserver` —— nue-ui `nue-scroll-bar` 依赖，jsdom 未实现。
 */

export type CssDecl = { prop: string; value: string }

export type CssRule = {
    /** 已展开的选择器列表（CSS 嵌套 `&` 已代入父选择器） */
    selectors: string[]
    decls: CssDecl[]
    /** 逐层 `@media` 条件（源序外层→内层）；非宽度 at-rule 记作 `@supports …`（视为命中） */
    media: string[]
}

// ====================================
// SFC / CSS 解析
// ====================================

/** 抽取 SFC 内全部 `<style>` 块文本并去注释（无 style 块返回空串） */
export const styleTextOf = (sfcSource: string): string => {
    const blocks = [...sfcSource.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(
        (match) => match[1] ?? ''
    )
    return blocks.join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
}

/** 按顶层逗号切分选择器列表（忽略括号内逗号） */
const splitSelectors = (selectorList: string): string[] => {
    const out: string[] = []
    let depth = 0
    let buf = ''
    for (const char of selectorList) {
        if (char === '(') depth += 1
        if (char === ')') depth -= 1
        if (char === ',' && depth === 0) {
            out.push(buf.trim())
            buf = ''
            continue
        }
        buf += char
    }
    out.push(buf.trim())
    return out.filter(Boolean)
}

/** 嵌套选择器展开：`&` 代入父选择器；无 `&` 视为后代选择器 */
const expandNested = (parents: string[], child: string): string[] => {
    const children = splitSelectors(child)
    if (parents.length === 0) return children
    const out: string[] = []
    for (const parent of parents) {
        for (const one of children) {
            out.push(one.includes('&') ? one.replaceAll('&', parent) : `${parent} ${one}`)
        }
    }
    return out
}

const pushDecl = (
    raw: string,
    selectors: string[],
    media: string[],
    out: CssRule[],
    target: CssRule | null
) => {
    const text = raw.trim()
    if (!text) return
    const colon = text.indexOf(':')
    if (colon <= 0) return
    const decl: CssDecl = {
        prop: text.slice(0, colon).trim().toLowerCase(),
        value: text
            .slice(colon + 1)
            .trim()
            .replace(/\s+/g, ' ')
    }
    if (target) target.decls.push(decl)
    else if (selectors.length > 0) out.push({ selectors, decls: [decl], media })
}

/** 解析块内容：声明（`;` 结尾）归入 `target`，遇到嵌套规则/at-rule 继续下钻 */
const parseBlock = (
    src: string,
    start: number,
    end: number,
    selectors: string[],
    media: string[],
    target: CssRule | null,
    out: CssRule[]
) => {
    let index = start
    let buf = ''

    while (index < end) {
        const char = src[index]

        if (char === '{') {
            let depth = 1
            let close = index + 1
            while (close < end && depth > 0) {
                if (src[close] === '{') depth += 1
                else if (src[close] === '}') depth -= 1
                if (depth === 0) break
                close += 1
            }
            const prelude = buf.trim()
            buf = ''

            if (prelude.startsWith('@')) {
                const [name, ...rest] = prelude.slice(1).trim().split(/\s+/)
                const condition =
                    name === 'media'
                        ? rest.join(' ')
                        : `@${name ?? 'unknown'} ${rest.join(' ')}`.trim()
                parseBlock(src, index + 1, close, selectors, [...media, condition], null, out)
            } else {
                const nextSelectors = expandNested(selectors, prelude)
                const rule: CssRule = { selectors: nextSelectors, decls: [], media }
                out.push(rule)
                parseBlock(src, index + 1, close, nextSelectors, media, rule, out)
            }
            index = close + 1
            continue
        }

        if (char === ';' || char === '}') {
            pushDecl(buf, selectors, media, out, target)
            buf = ''
            index += 1
            continue
        }

        buf += char
        index += 1
    }

    pushDecl(buf, selectors, media, out, target)
}

/** 解析 CSS 文本为规则表（源序保留；`&` 嵌套与 `@media` 嵌套已展开） */
export const parseCssRules = (css: string): CssRule[] => {
    const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '')
    const out: CssRule[] = []
    parseBlock(cleaned, 0, cleaned.length, [], [], null, out)
    return out.filter((rule) => rule.decls.length > 0)
}

// ====================================
// 生效值推演
// ====================================

/** `@media` 条件是否在给定视口宽度下命中（只解析宽度约束；非宽度条件视为命中） */
export const mediaApplies = (condition: string, width: number): boolean => {
    if (!condition) return true
    if (condition.startsWith('@')) return true
    const collects = (pattern: RegExp): number[] =>
        [...condition.matchAll(pattern)].map((match) => Number(match[1]))
    const constraints: boolean[] = [
        ...collects(/max-width\s*:\s*(\d+(?:\.\d+)?)px/g).map((value) => width <= value),
        ...collects(/min-width\s*:\s*(\d+(?:\.\d+)?)px/g).map((value) => width >= value),
        ...collects(/width\s*<=\s*(\d+(?:\.\d+)?)px/g).map((value) => width <= value),
        ...collects(/width\s*>=\s*(\d+(?:\.\d+)?)px/g).map((value) => width >= value)
    ]
    return constraints.every(Boolean)
}

/** 选择器末段（最后一个复合选择器），用于把 `#a > .b .c` 归到 `.c` */
const lastCompound = (selector: string): string =>
    selector
        .split(/[\s>+~]+/)
        .filter(Boolean)
        .pop() ?? ''

/** 该规则在给定宽度下是否命中目标选择器末段 */
const matchesTarget = (rule: CssRule, selector: string): boolean =>
    rule.selectors.some((one) => lastCompound(one) === selector)

/** 按宽度过滤「此刻生效」的规则（源序） */
export const effectiveRules = (rules: CssRule[], width: number): CssRule[] =>
    rules.filter((rule) => rule.media.every((condition) => mediaApplies(condition, width)))

/** 目标选择器在给定宽度下的生效声明（源序；同名属性后者胜） */
export const effectiveDecls = (rules: CssRule[], selector: string, width: number): CssDecl[] =>
    effectiveRules(rules, width)
        .filter((rule) => matchesTarget(rule, selector))
        .flatMap((rule) => rule.decls)

/** 取某属性最后一条生效值（无声明返回 null） */
export const effectiveValue = (
    rules: CssRule[],
    selector: string,
    prop: string,
    width: number
): string | null => {
    const decls = effectiveDecls(rules, selector, width).filter((decl) => decl.prop === prop)
    return decls.length > 0 ? (decls[decls.length - 1]?.value ?? null) : null
}

/**
 * 主题 token → px（源：`nue-ui-theme-shadlike/dist/global/variables.css`，`--nue-primary-font-size-base: 16px`）
 * ⚠️ 仅收录本单推演用到的 token；数值变更时这里的解析结果会打印在用例输出里，便于发现漂移。
 */
export const NUE_TOKEN_PX: Record<string, number> = {
    '--nue-text-2xs': 10,
    '--nue-text-xs': 12,
    '--nue-text-sm': 14,
    '--nue-text-df': 16,
    '--nue-text-md': 18,
    '--nue-text-lg': 20,
    '--nue-text-xl': 22,
    '--nue-padding-2xs': 4,
    '--nue-padding-xs': 8,
    '--nue-padding-sm': 12,
    '--nue-padding-df': 16,
    '--nue-padding-md': 20,
    '--nue-padding-lg': 24,
    '--nue-gap-2xs': 4,
    '--nue-gap-xs': 8,
    '--nue-gap-sm': 12,
    '--nue-gap-df': 16,
    '--nue-gap-md': 20,
    '--nue-gap-lg': 24,
    '--nue-box-size-2xs': 24,
    '--nue-box-size-xs': 28,
    '--nue-box-size-sm': 32,
    '--nue-box-size-df': 36,
    '--nue-box-size-md': 40,
    '--nue-box-size-lg': 44
}

/** 数值化：`760px` / `3.5rem` / `var(--nue-gap-xs)` / `40` → 像素数（无法解析返回 null） */
export const resolvePx = (value: string | null): number | null => {
    if (!value) return null
    const text = value.trim()
    const px = /^(-?\d+(?:\.\d+)?)px$/.exec(text)
    if (px) return Number(px[1])
    const rem = /^(-?\d+(?:\.\d+)?)rem$/.exec(text)
    if (rem) return Number(rem[1]) * 16
    const bare = /^(-?\d+(?:\.\d+)?)$/.exec(text)
    if (bare) return Number(bare[1])
    const token = /^var\(\s*(--[\w-]+)\s*\)$/.exec(text)
    if (token) return NUE_TOKEN_PX[token[1]!] ?? null
    return null
}

/** 兼容旧名（等价 `resolvePx`） */
export const toPx = resolvePx

/** `padding/margin/inset` 简写 → 垂直方向合计（1 值 ×2；2 值取首；3 值取首+末；4 值取首+末） */
export const boxVerticalPx = (value: string | null): number | null => {
    if (!value) return null
    const parts = value.trim().split(/\s+/)
    const nums = parts.map((part) => resolvePx(part.replace('auto', '0')))
    if (nums.some((num) => num === null)) return null
    const list = nums as number[]
    if (list.length === 1) return Math.abs(list[0]! * 2)
    if (list.length === 2) return Math.abs(list[0]! * 2)
    if (list.length === 3) return Math.abs(list[0]! + list[2]!)
    return Math.abs(list[0]! + list[2]!)
}

/** 伪元素负向扩展的「每侧外扩量」（`inset` / `top`+`bottom`） */
const verticalExpansionPx = (decls: CssDecl[]): number | null => {
    let top: number | null = null
    let bottom: number | null = null
    for (const decl of decls) {
        if (decl.prop === 'inset') {
            const parts = decl.value.split(/\s+/)
            const values = parts.map((part) => resolvePx(part))
            if (values.some((value) => value === null)) continue
            const list = values as number[]
            const pick = (index: number) => list[Math.min(index, list.length - 1)]!
            top = pick(0)
            bottom = list.length >= 3 ? pick(2) : pick(0)
        } else if (decl.prop === 'top') {
            top = resolvePx(decl.value)
        } else if (decl.prop === 'bottom') {
            bottom = resolvePx(decl.value)
        }
    }
    if (top === null || bottom === null) return null
    if (top >= 0 || bottom >= 0) return null
    return Math.min(Math.abs(top), Math.abs(bottom))
}

export type HitAreaBox = {
    selectors: string[]
    media: string[]
    narrow: boolean
    content: string | null
    pseudoHeightPx: number | null
    expandedPerSide: number | null
    buttonVisualPx: number
    hitAreaPx: number | null
    overflowVisible: boolean
    positionRelative: boolean
    satisfied: boolean
    reason: string
}

export type ButtonHeightDecl = {
    selectors: string[]
    media: string[]
    narrow: boolean
    prop: string
    value: string
    px: number
}

/**
 * 命中区推演（R10）：`可点区 ≥40px` 由「按钮视觉高 + 伪元素外扩」达成
 * @param buttonVisualPx NueButton small 视觉高（`.nue-button--small { height: var(--nue-box-size-xs) }` = 28px）
 *
 * satisfied 的三项必要条件：① 伪元素有 `content`；② 按钮 `overflow: visible`（否则 `::after` 被裁掉、扩展静默失效）；
 * ③ 伪元素 `height ≥ 40px` 或 垂直每侧外扩 ≥6px（28 + 2×6 = 40）。absolute 定位形态还需 `position: relative`。
 */
export const hitAreaEvidence = (
    rules: CssRule[],
    width: number,
    buttonVisualPx = NUE_TOKEN_PX['--nue-box-size-xs'] ?? 28
): { boxes: HitAreaBox[]; directHeights: ButtonHeightDecl[] } => {
    const applicable = effectiveRules(rules, width)
    const buttonRules = applicable.filter(
        (rule) =>
            rule.selectors.some((selector) => /nue-button/.test(selector)) &&
            !rule.selectors.some((selector) => selector.includes('::'))
    )
    const buttonDecls = buttonRules.flatMap((rule) => rule.decls)
    const overflowVisible = buttonDecls.some(
        (decl) => decl.prop === 'overflow' && /\bvisible\b/.test(decl.value)
    )
    const positionRelative = buttonDecls.some(
        (decl) => decl.prop === 'position' && decl.value === 'relative'
    )
    const directHeights: ButtonHeightDecl[] = buttonRules.flatMap((rule) =>
        rule.decls
            .filter((decl) => /^(min-height|min-block-size|height)$/.test(decl.prop))
            .map((decl) => ({
                selectors: rule.selectors,
                media: rule.media,
                narrow: isNarrowScoped(rule, width),
                prop: decl.prop,
                value: decl.value,
                px: resolvePx(decl.value) ?? -1
            }))
    )

    const boxes: HitAreaBox[] = applicable
        .filter(
            (rule) =>
                rule.selectors.some((selector) => /::(after|before)/.test(selector)) &&
                rule.selectors.some((selector) => /nue-button|pagination|pager/i.test(selector))
        )
        .map((rule) => {
            const content = rule.decls.find((decl) => decl.prop === 'content')?.value ?? null
            const heightDecl = [...rule.decls]
                .reverse()
                .find((decl) => /^(min-height|min-block-size|height)$/.test(decl.prop))
            const pseudoHeightPx = resolvePx(heightDecl?.value ?? null)
            const expandedPerSide = verticalExpansionPx(rule.decls)
            const usesAbsolute = rule.decls.some(
                (decl) => decl.prop === 'position' && decl.value === 'absolute'
            )
            const hitAreaPx =
                pseudoHeightPx !== null && pseudoHeightPx >= buttonVisualPx
                    ? pseudoHeightPx
                    : expandedPerSide !== null
                      ? buttonVisualPx + expandedPerSide * 2
                      : null

            let reason = 'ok'
            if (content === null) reason = '伪元素无 content'
            else if (!overflowVisible)
                reason = '按钮缺 overflow:visible ⇒ 伪元素被裁掉（扩展静默失效）'
            else if (usesAbsolute && !positionRelative)
                reason = 'absolute 定位缺 position:relative（定位基准错误）'
            else if (hitAreaPx === null) reason = '伪元素未声明可推演的高度/外扩量'
            else if (hitAreaPx < 40) reason = `命中区仅 ${hitAreaPx}px < 40px`

            return {
                selectors: rule.selectors,
                media: rule.media,
                narrow: isNarrowScoped(rule, width),
                content,
                pseudoHeightPx,
                expandedPerSide,
                buttonVisualPx,
                hitAreaPx,
                overflowVisible,
                positionRelative,
                satisfied: reason === 'ok',
                reason
            }
        })

    return { boxes, directHeights }
}

/** 生效的纵向 `overflow`（`overflow-y` 优先，回落 `overflow` 简写；无声明返回 null） */
export const effectiveOverflowY = (
    rules: CssRule[],
    selector: string,
    width: number
): string | null => {
    const decls = effectiveDecls(rules, selector, width)
    let value: string | null = null
    for (const decl of decls) {
        if (decl.prop === 'overflow-y') value = decl.value
        else if (decl.prop === 'overflow') {
            const parts = decl.value.split(/\s+/)
            value = parts.length > 1 ? (parts[1] ?? null) : decl.value
        }
    }
    return value
}

/** 规则（按选择器正则命中）在给定宽度下是否声明了满足判据的某属性 */
export const hasDeclMatching = (
    rules: CssRule[],
    width: number,
    selectorPattern: RegExp,
    propPattern: RegExp,
    valuePattern: RegExp
): boolean =>
    effectiveRules(rules, width).some(
        (rule) =>
            rule.selectors.some((selector) => selectorPattern.test(selector)) &&
            rule.decls.some((decl) => propPattern.test(decl.prop) && valuePattern.test(decl.value))
    )

/** 该规则是否为「窄屏分支」（含至少一条在给定宽度下命中的宽度媒体条件） */
export const isNarrowScoped = (rule: CssRule, width: number): boolean =>
    rule.media.some(
        (condition) =>
            /(?:max-width|min-width)\s*:|width\s*[<>]=?/.test(condition) &&
            mediaApplies(condition, width)
    )

/** 窄屏分支内、选择器命中的声明（只在 `@media` 窗口内声明的属性，用于「窄屏专属调整」守卫） */
export const narrowScopedDecls = (
    rules: CssRule[],
    width: number,
    selectorPattern: RegExp
): CssDecl[] =>
    rules
        .filter(
            (rule) => isNarrowScoped(rule, width) && rule.media.every((c) => mediaApplies(c, width))
        )
        .filter((rule) => rule.selectors.some((selector) => selectorPattern.test(selector)))
        .flatMap((rule) => rule.decls)

/**
 * 收集记录页**所有分支**（窄屏 + 桌面）媒体查询的宽度阈值（去重升序）
 * 用于「不新增第三套断点」守卫 —— 同时识别 `max-width/min-width: Npx` 与 `width <= Npx` 两种写法。
 */
export const mediaBreakpoints = (rules: CssRule[]): number[] => {
    const found = new Set<number>()
    for (const rule of rules) {
        for (const condition of rule.media) {
            const matches = condition.matchAll(
                /(?:max-width|min-width)\s*:\s*(\d+)px|width\s*[<>]=?\s*(\d+)px/g
            )
            for (const match of matches) {
                const value = Number(match[1] ?? match[2])
                if (Number.isFinite(value)) found.add(value)
            }
        }
    }
    return [...found].sort((a, b) => a - b)
}

// ====================================
// 视口 / 环境夹具
// ====================================

type QueryListLike = {
    matches: boolean
    media: string
    onchange: null
    addListener: () => void
    removeListener: () => void
    addEventListener: () => void
    removeEventListener: () => void
    dispatchEvent: () => boolean
}

/**
 * 设定视口宽度：同时改 `innerWidth`/`outerWidth` 并 stubs `matchMedia`
 * ⇒ CSS `@media` 驱动（DOM 两套都在）与 JS 宽度驱动（`matchMedia`/`innerWidth`）都能命中。
 * @returns 还原函数（`afterEach` 调用）
 */
export const setViewport = (width: number): (() => void) => {
    const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth')
    const originalOuterWidth = Object.getOwnPropertyDescriptor(window, 'outerWidth')
    const originalMatchMedia = window.matchMedia

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    Object.defineProperty(window, 'outerWidth', { configurable: true, value: width })

    window.matchMedia = ((query: string): QueryListLike => {
        const condition = query.replace(/^@media\s*/i, '')
        return {
            matches: mediaApplies(condition, width),
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false
        }
    }) as unknown as typeof window.matchMedia

    return () => {
        if (originalInnerWidth) Object.defineProperty(window, 'innerWidth', originalInnerWidth)
        if (originalOuterWidth) Object.defineProperty(window, 'outerWidth', originalOuterWidth)
        window.matchMedia = originalMatchMedia
    }
}

/** nue-ui `nue-scroll-bar` 依赖 `ResizeObserver`（jsdom 未实现） */
export const stubResizeObserver = (): void => {
    class ResizeObserverStub {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
    ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub
    ;(window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub
}