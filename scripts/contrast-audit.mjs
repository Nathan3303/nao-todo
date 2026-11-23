/**
 * 对比度审计守卫（WCAG 2.1 · light 模式）
 * @description 按**声明式 pair 表**计算真实主题 token 的对比度，守住 DESIGN.md §2 的验收阈值：
 * 文本 ≥4.5:1、承载语义的图形 / 边框 ≥3:1。
 *  1. 色值来源（后者覆盖前者，与 CSS 导入顺序一致）：
 *     `node_modules/nue-ui-theme-shadlike/dist/global/variables.css` → `apps/web/src/themes/variables.css`；
 *  2. 支持 `#hex` 与 `hsl(h, s%, l%)`（各分量可为 `var(--x)` 链 / `calc()`；`--nue-dark-switch` 固定 0 = light）；
 *  3. **无法精确解析即报错退出**（`hsl(from …)` / `color-mix()` / `oklch()` / 未定义 var / 循环引用），
 *     打印 token 名与原值，⛔ 不猜、不静默跳过 —— 静默跳过等于把守卫变成空转；
 *  4. pair 表只收**真实用法**（每行注明用途），不掺入未在界面上出现的组合。
 * 自证：本文件的 hsl 求值器重算旧 DESIGN.md 实测的 9 个 hex（#333333 / #666666 / #cccccc /
 * #1b981b / #a15912 / #a12a12 / #178217 / #8a4d0f / #8a240f）逐字节吻合。
 * 用途：`pnpm run guard:contrast`（本地 / 批末门禁）。
 * **CI 走 vitest**（`.github/workflows/**` 之外）：`packages/shared/__tests__/contrast-audit.test.ts`
 * 复用本文件的 `evaluatePairs` / `THRESHOLD` / `PAIRS` 断言真实主题 0 条不达标，并对注入的坏 token 必报错。
 * 本文件的 CLI 与前述用例共用同一份阈值与 pair 表（单一事实来源）。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
export const SOURCES = [
    'node_modules/nue-ui-theme-shadlike/dist/global/variables.css',
    'apps/web/src/themes/variables.css'
]
export const DARK_SWITCH = '--nue-dark-switch'
const MAX_DEPTH = 32

/** DESIGN.md §2 验收阈值：文本 / 承载语义的图形·边框 */
export const TEXT_MIN = 4.5
export const GRAPHIC_MIN = 3
/** kind → 阈值（pair 表第 1 列即 kind） */
export const THRESHOLD = { text: TEXT_MIN, graphic: GRAPHIC_MIN }

/**
 * 声明式 pair 表：kind=text ⇒ ≥4.5；kind=graphic ⇒ ≥3（承载语义的图形 / 状态边框）
 * @type {Array<[string, string, string, string]>}
 */
export const PAIRS = [
    // —— 文本：页面底色 ——
    ['text', '--nue-primary-text-color', '--nue-primary-color-0', '正文（页面底色 / 卡片）'],
    ['text', '--nue-primary-color-900', '--nue-primary-color-0', '正文·深档（对话框 / 容器标题）'],
    ['text', '--nue-secondary-text-color', '--nue-primary-color-0', '次要文字（说明 / 分区标题）'],
    ['text', '--nue-secondary-text-color', '--nue-primary-color-100', '次要文字 on 淡底（列表 hover / 胶囊底）'],
    // —— 文本：页面底色上的语义色 ——
    ['text', '--nue-success-color-90', '--nue-primary-color-0', 'success 文字标签'],
    ['text', '--nue-success-color-100', '--nue-primary-color-0', 'success 文字（冲突「云端新增」）'],
    ['text', '--nue-warning-color-90', '--nue-primary-color-0', 'warning 文字标签'],
    ['text', '--nue-error-color-90', '--nue-primary-color-0', 'error 文字标签'],
    // —— 文本：语义淡底上（同步面板计数胶囊；语义色「淡档」= -10，不是 -100） ——
    ['text', '--nue-warning-color-90', '--nue-warning-color-10', 'warning 胶囊文字 on 淡底'],
    ['text', '--nue-error-color-90', '--nue-error-color-10', 'error 胶囊文字 on 淡底'],
    // —— 文本：实心语义按钮（白字 on -100 深填充；语义色阶 -100 = 最深，不是淡底） ——
    ['text', '--nue-success-color-0', '--nue-success-color-100', '实心 success 按钮文字'],
    ['text', '--nue-warning-color-0', '--nue-warning-color-100', '实心 warning 按钮文字'],
    ['text', '--nue-error-color-0', '--nue-error-color-100', '实心 error 按钮文字'],
    // —— 图形：三态符号 / 色条 / 状态边框 ——
    ['graphic', '--nue-success-color-80', '--nue-primary-color-0', 'success 图形 / 符号'],
    ['graphic', '--nue-warning-color-80', '--nue-primary-color-0', 'warning 图形 / 符号'],
    ['graphic', '--nue-error-color-80', '--nue-primary-color-0', 'error 图形 / 符号'],
    ['graphic', '--nue-primary-color-500', '--nue-primary-color-0', '进度条内条 / 中性图形']
]

/** 解析 `--name:value` 声明（括号深度内的 `;` `}` 不作边界；主题文件是压缩单行） */
export const parseDeclarations = (css) => {
    const map = new Map()
    const src = css.replace(/\/\*[\s\S]*?\*\//g, '')
    let i = 0
    let depth = 0
    while (i < src.length) {
        const ch = src[i]
        if (ch === '(') {
            depth++
            i++
            continue
        }
        if (ch === ')') {
            depth--
            i++
            continue
        }
        if (depth === 0 && src.startsWith('--', i)) {
            const colon = src.indexOf(':', i)
            const name = src.slice(i, colon).trim()
            let j = colon + 1
            let d = 0
            let value = ''
            while (j < src.length) {
                const c = src[j]
                if (c === '(') d++
                else if (c === ')') d--
                else if (d === 0 && (c === ';' || c === '}')) break
                value += c
                j++
            }
            map.set(name, value.trim())
            i = j
            continue
        }
        i++
    }
    return map
}

/**
 * 载入主题 token 表（后一个来源覆盖前一个）
 * @param {{root?: string, sources?: string[]}} [options]
 * @returns {Map<string, string>}
 */
export const loadThemeTokens = ({ root = ROOT, sources = SOURCES } = {}) => {
    const tokens = new Map()
    for (const rel of sources) {
        const css = readFileSync(resolve(root, rel), 'utf8')
        const decls = parseDeclarations(css)
        if (decls.size === 0) throw new Error(`${rel}: 解析到 0 条声明（守卫会空转，拒绝）`)
        for (const [k, v] of decls) tokens.set(k, v)
    }
    // light 模式：--nue-dark-switch 固定 0（theme 自带该声明，若被改写则下面求值会随之变化）
    if (!tokens.has(DARK_SWITCH)) throw new Error(`主题缺少 ${DARK_SWITCH} 声明`)
    return tokens
}

/** 极小递归下降求值器：+ - * / 括号与小数（`%` 视作无量纲） */
const evalExpr = (src) => {
    let i = 0
    const skip = () => {
        while (i < src.length && /\s/.test(src[i])) i++
    }
    const atom = () => {
        skip()
        if (src[i] === '(') {
            i++
            const v = sum()
            skip()
            if (src[i] !== ')') throw new Error(`括号不配对: ${src}`)
            i++
            return v
        }
        const m = /^\d*\.?\d+/.exec(src.slice(i))
        if (!m) throw new Error(`无法解析数值: ${src}`)
        i += m[0].length
        if (src[i] === '%') i++
        return Number(m[0])
    }
    const unary = () => {
        skip()
        if (src[i] === '-') {
            i++
            return -unary()
        }
        if (src[i] === '+') {
            i++
            return unary()
        }
        return atom()
    }
    const product = () => {
        let v = unary()
        for (;;) {
            skip()
            const c = src[i]
            if (c !== '*' && c !== '/') return v
            i++
            const r = unary()
            v = c === '*' ? v * r : v / r
        }
    }
    const sum = () => {
        let v = product()
        for (;;) {
            skip()
            const c = src[i]
            if (c !== '+' && c !== '-') return v
            i++
            const r = product()
            v = c === '+' ? v + r : v - r
        }
    }
    const v = sum()
    skip()
    if (i !== src.length) throw new Error(`表达式含多余字符: ${src}`)
    if (!Number.isFinite(v)) throw new Error(`非有限数值: ${src}`)
    return v
}

/** 把 var() 全部代换为数值，再求值（支持 calc 与嵌套 var 链） */
const evalScalar = (tokens, expr, depth = 0) => {
    if (depth > MAX_DEPTH) throw new Error(`var/calc 解析过深（疑似循环引用）: ${expr}`)
    let out = ''
    let i = 0
    while (i < expr.length) {
        if (expr.startsWith('var(', i)) {
            const close = matchParen(expr, i + 3)
            const inner = expr.slice(i + 4, close)
            const parts = splitTop(inner, ',')
            const name = parts[0].trim()
            if (!name.startsWith('--')) throw new Error(`var() 里不是自定义属性: ${inner}`)
            const raw = tokens.get(name)
            if (raw === undefined) {
                if (parts.length > 1) {
                    out += String(evalScalar(tokens, parts.slice(1).join(','), depth + 1))
                    i = close + 1
                    continue
                }
                throw new Error(`未定义的变量 ${name}`)
            }
            out += String(evalScalar(tokens, raw, depth + 1))
            i = close + 1
            continue
        }
        out += expr[i]
        i++
    }
    // calc(...) 只是显式的运算容器，脱掉外壳后交给求值器
    const stripped = out.replace(/calc\s*\(/g, '(')
    return evalExpr(stripped)
}

/** 返回 index 处 `(` 对应的 `)` 位置 */
function matchParen(src, openIdx) {
    let d = 0
    for (let i = openIdx; i < src.length; i++) {
        if (src[i] === '(') d++
        else if (src[i] === ')') {
            d--
            if (d === 0) return i
        }
    }
    throw new Error(`括号未闭合: ${src}`)
}

/** 顶层（括号外）逗号切分 */
function splitTop(src, sep) {
    const parts = []
    let d = 0
    let cur = ''
    for (const ch of src) {
        if (ch === '(') d++
        else if (ch === ')') d--
        if (ch === sep && d === 0) {
            parts.push(cur)
            cur = ''
            continue
        }
        cur += ch
    }
    parts.push(cur)
    return parts
}

const hslToRgb = (h, s, l) => {
    const ss = s / 100
    const ll = l / 100
    const c = (1 - Math.abs(2 * ll - 1)) * ss
    const hp = (((h % 360) + 360) % 360) / 60
    const x = c * (1 - Math.abs((hp % 2) - 1))
    const m = ll - c / 2
    const seg =
        hp < 1
            ? [c, x, 0]
            : hp < 2
              ? [x, c, 0]
              : hp < 3
                ? [0, c, x]
                : hp < 4
                  ? [0, x, c]
                  : hp < 5
                    ? [x, 0, c]
                    : [c, 0, x]
    return seg.map((v) => Math.round((v + m) * 255))
}

/** token → RGB（支持 #hex / var 别名 / hsl；其余形态如实报错） */
export const toRgb = (tokens, name, depth = 0) => {
    if (depth > MAX_DEPTH) throw new Error(`${name}: 别名链过深（疑似循环引用）`)
    const raw = tokens.get(name)
    if (raw === undefined) throw new Error(`${name}: 主题未定义该 token`)
    const lower = raw.toLowerCase()
    if (lower.startsWith('#')) {
        const hex = raw.slice(1)
        if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex))
            throw new Error(`${name}: 不支持带透明度的 hex '${raw}'`)
        const full =
            hex.length === 3
                ? [...hex]
                      .map((c) => c + c)
                      .join('')
                : hex
        return [0, 2, 4].map((k) => parseInt(full.slice(k, k + 2), 16))
    }
    if (lower.startsWith('var(')) {
        const inner = raw.slice(4, matchParen(raw, 3))
        const target = splitTop(inner, ',')[0].trim()
        return toRgb(tokens, target, depth + 1)
    }
    if (/^hsl\(\s*from/.test(lower)) throw new Error(`${name}: 不支持相对色 '${raw}'`)
    if (lower.startsWith('hsl(')) {
        const inner = raw.slice(4, matchParen(raw, 3))
        const parts = splitTop(inner, ',')
        if (parts.length !== 3) throw new Error(`${name}: hsl() 参数个数异常 '${raw}'`)
        return hslToRgb(...parts.map((p) => evalScalar(tokens, p)))
    }
    throw new Error(`${name}: 不支持的色值形态 '${raw}'（只支持 #hex 与 hsl(h,s%,l%)）`)
}

const luminance = (rgb) => {
    const ch = (v) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2])
}
export const contrastRatio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p)
    return (hi + 0.05) / (lo + 0.05)
}
export const toHex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('')

/**
 * 纯函数：按 pair 表逐行评估（无文件 IO、无全局状态 —— 供 CLI 与 vitest 用例共用）
 * @param {Map<string, string>} tokens token → 原始值（`#hex` / `hsl(...)` / `var(...)`）
 * @param {Array<[string, string, string, string]>} [pairs] `[kind, fg, bg, usage]`
 * @param {{text: number, graphic: number}} [thresholds]
 * @returns {Array<{ok: boolean, kind: string, fg: string, bg: string, usage: string, ratio?: number,
 *   min?: number, fgHex?: string, bgHex?: string, error?: string}>}
 *   **解析失败的行同样 `ok:false` 并带 `error`**（不静默跳过）
 */
export const evaluatePairs = (tokens, pairs = PAIRS, thresholds = THRESHOLD) => {
    const rows = []
    for (const [kind, fg, bg, usage] of pairs) {
        try {
            const fgRgb = toRgb(tokens, fg)
            const bgRgb = toRgb(tokens, bg)
            const ratio = contrastRatio(fgRgb, bgRgb)
            const min = thresholds[kind]
            rows.push({
                ok: ratio >= min,
                kind,
                fg,
                bg,
                usage,
                ratio,
                min,
                fgHex: toHex(fgRgb),
                bgHex: toHex(bgRgb)
            })
        } catch (error) {
            rows.push({ ok: false, kind, fg, bg, usage, error: error.message })
        }
    }
    return rows
}

/**
 * 审计真实主题（读 CSS → 解析 token → 评估 pair 表）
 * @param {{root?: string, sources?: string[], pairs?: Array<[string, string, string, string]>,
 *   thresholds?: {text: number, graphic: number}, tokens?: Map<string, string>}} [options]
 * @returns {{tokens: Map<string, string>, rows: object[], failures: object[]}}
 */
export const auditContrast = (options = {}) => {
    const { pairs = PAIRS, thresholds = THRESHOLD } = options
    const tokens = options.tokens ?? loadThemeTokens(options)
    const rows = evaluatePairs(tokens, pairs, thresholds)
    return { tokens, rows, failures: rows.filter((row) => !row.ok) }
}

const short = (token) => token.replace('--nue-', '')

const main = () => {
    const { rows, failures } = auditContrast()

    console.log(`[guard:contrast] light 模式（${DARK_SWITCH}=0）· 来源 ${SOURCES.length} 个 CSS`)
    console.log(`  阈值：文本 ≥${THRESHOLD.text} · 图形/边框 ≥${THRESHOLD.graphic}\n`)
    for (const r of rows) {
        const head = `${r.ok ? 'PASS' : 'FAIL'} ${r.kind.padEnd(7)} ${short(r.fg)} on ${short(r.bg)}`
        if (r.error) {
            console.log(`  ${head}\n        解析失败：${r.error}`)
            continue
        }
        console.log(
            `  ${head.padEnd(62)} ${r.ratio.toFixed(2).padStart(6)}:1 (≥${r.min}) ` +
                `${r.fgHex} on ${r.bgHex}  · ${r.usage}`
        )
    }

    if (failures.length > 0) {
        console.error(`\n[guard:contrast] 不达标 ${failures.length}/${rows.length} 组：`)
        for (const f of failures)
            console.error(
                `  - ${f.kind} ${f.fg} on ${f.bg}（${f.usage}）：` +
                    (f.error ? `解析失败 ${f.error}` : `${f.ratio.toFixed(2)}:1 < ${f.min}`)
            )
        process.exit(1)
    }
    console.log(`\n[guard:contrast] OK - ${rows.length} 组 pair 全部达标`)
}

// 仅在作为 CLI 直接执行时跑；被 `import`（vitest 用例）时不产生副作用
const invokedPath = process.argv[1]
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) main()
