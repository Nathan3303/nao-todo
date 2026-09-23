/**
 * barrel 导入面可解析性守卫
 * @description 校验全仓对内部包（`@nao-todo/*`）的**命名导入 / 命名再导出**均可解析到目标模块的
 * 真实导出符号。覆盖 `.vue` / `.ts` / `.tsx` / `.mjs` / `.js`，且**包含 type-only 导入**
 * （`import type`、`import { type X }`、`export type { X } from`）与 `export { A as B }` 别名形式。
 *
 * 背景（`T123` W3a 实测暴露的 `vp check` 真实盲区）：`.vue` 内的 type-only 导入若指向不存在符号，
 * `vp check` 报 0 error，但 `tsc` 报 `TS2305: Module has no exported member`。本守卫为纯静态
 * （不依赖 TS / tsc），把该盲区固化为正式门禁。
 *
 * 覆盖内容：
 *  1. 解析 `@nao-todo/<pkg>` 与 `@nao-todo/<pkg>/<sub>` → 磁盘文件（含 `index.*` 目录桶）；
 *  2. 构建目标模块的导出符号表：`export * from`（递归 + 环检测）/ `export * as ns from` /
 *     `export { A, B as C } (from)` / `export type { X }`（局部形式）/ 各类声明 /
 *     `export default`（含 `.vue` 恒有 default）；
 *  3. 逐文件校验命名导入（导入名取 `as` 左侧）与 `export ... from '@nao-todo/*'`。
 *
 * 用途：CI / 提交前手动跑 `pnpm guard:barrel-imports`。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** 扫描源码的扩展名（按 T126 口径含 .vue / .tsx / .mjs，另含 .ts / .js / .mts / .cts） */
const SOURCE_EXTS = ['.ts', '.tsx', '.vue', '.mjs', '.js', '.mts', '.cts']
/** 模块解析时尝试的扩展名 */
const RESOLVE_EXTS = ['.ts', '.tsx', '.vue', '.mjs', '.js', '.mts', '.cts']
/** 跳过扫描的目录（构建产物 / 依赖 / 索引 / 舰队资产） */
const IGNORE_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    'out',
    'release',
    'build',
    'coverage',
    '.codegraph',
    '.agents',
    '.pi',
    '.vite-hooks'
])

const isIdentStart = (c) => c !== undefined && /[A-Za-z_$]/.test(c)
const isIdent = (c) => c !== undefined && /[A-Za-z0-9_$]/.test(c)
const isSpace = (c) => c === ' ' || c === '\t' || c === '\r' || c === '\n'

const existsFile = (p) => {
    try {
        return statSync(p).isFile()
    } catch {
        return false
    }
}

const fileCache = new Map()
const readFile = (p) => {
    if (!fileCache.has(p)) fileCache.set(p, readFileSync(p, 'utf8'))
    return fileCache.get(p)
}

/** 从 `i`（引号位置）读取字符串结尾，返回 `{ end }`；模板串按 `${}` 平衡跳过 */
const readString = (src, i) => {
    const quote = src[i]
    let j = i + 1
    const n = src.length
    while (j < n) {
        const c = src[j]
        if (c === '\\') {
            j += 2
            continue
        }
        if (c === quote) return { end: j + 1 }
        if (quote === '`' && c === '$' && src[j + 1] === '{') {
            let depth = 1
            j += 2
            while (j < n && depth > 0) {
                if (src[j] === '\\') {
                    j += 2
                    continue
                }
                if (src[j] === '{') depth += 1
                else if (src[j] === '}') depth -= 1
                j += 1
            }
            continue
        }
        j += 1
    }
    return { end: n }
}

/** 剥离注释（保留字符串字面量，避免误伤模块说明符）；用于导出符号表的正则扫描 */
const stripComments = (src) => {
    let out = ''
    let i = 0
    const n = src.length
    while (i < n) {
        const c = src[i]
        if (c === '"' || c === "'" || c === '`') {
            const { end } = readString(src, i)
            out += src.slice(i, end)
            i = end
            continue
        }
        if (c === '/' && src[i + 1] === '/') {
            const nl = src.indexOf('\n', i)
            i = nl === -1 ? n : nl
            continue
        }
        if (c === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2)
            i = end === -1 ? n : end + 2
            continue
        }
        out += c
        i += 1
    }
    return out
}

/**
 * 从 `import` / `export` 关键字后扫描，定位 `from '<spec>'`（或 `import '<spec>'` 副作用式）。
 * 返回 `{ spec, header, end, sideEffect }`；非 from 语句（如 `export const`）返回 null。
 */
const parseFromStatement = (src, k, keyword) => {
    const n = src.length
    let p = k
    while (p < n && isSpace(src[p])) p += 1
    if (keyword === 'import' && (src[p] === '"' || src[p] === "'")) {
        const { end } = readString(src, p)
        return { spec: src.slice(p + 1, end - 1), header: '', end, sideEffect: true }
    }
    let i = k
    let depth = 0
    const limit = Math.min(n, k + 4000)
    while (i < limit) {
        const c = src[i]
        if (c === '"' || c === "'" || c === '`') {
            i = readString(src, i).end
            continue
        }
        if (c === '/' && src[i + 1] === '/') {
            const nl = src.indexOf('\n', i)
            i = nl === -1 ? n : nl + 1
            continue
        }
        if (c === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2)
            i = end === -1 ? n : end + 2
            continue
        }
        if (c === '{') {
            depth += 1
            i += 1
            continue
        }
        if (c === '}') {
            depth -= 1
            if (depth < 0) return null
            i += 1
            continue
        }
        if (c === ';' && depth === 0) return null
        if (isIdentStart(c)) {
            let j = i
            while (j < n && isIdent(src[j])) j += 1
            const word = src.slice(i, j)
            if (word === 'from') {
                let q = j
                while (q < n && isSpace(src[q])) q += 1
                if (src[q] === '"' || src[q] === "'") {
                    const { end } = readString(src, q)
                    return {
                        spec: src.slice(q + 1, end - 1),
                        header: src.slice(k, i),
                        end,
                        sideEffect: false
                    }
                }
            }
            if ((word === 'import' || word === 'export') && i !== k) return null
            i = j
            continue
        }
        i += 1
    }
    return null
}

/** 扫描源码中所有 `import ... from` / `export ... from` 语句 */
const scanStatements = (src) => {
    const out = []
    let i = 0
    const n = src.length
    while (i < n) {
        const c = src[i]
        if (c === '"' || c === "'" || c === '`') {
            i = readString(src, i).end
            continue
        }
        if (c === '/' && src[i + 1] === '/') {
            const nl = src.indexOf('\n', i)
            i = nl === -1 ? n : nl + 1
            continue
        }
        if (c === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2)
            i = end === -1 ? n : end + 2
            continue
        }
        if (isIdentStart(c)) {
            let j = i
            while (j < n && isIdent(src[j])) j += 1
            const word = src.slice(i, j)
            if (word === 'import' || word === 'export') {
                const stmt = parseFromStatement(src, j, word)
                if (stmt) {
                    out.push(stmt)
                    i = stmt.end
                    continue
                }
            }
            i = j
            continue
        }
        i += 1
    }
    return out
}

/** 解析语句 header：返回 `{ names, defaultImport }`；`names` 为待校验的**导入名**（`as` 左侧） */
const parseHeader = (header) => {
    let h = header.trim()
    if (h === '' || h === '*') return { names: [], defaultImport: false }
    if (/^\*\s+as\s+/.test(h)) return { names: [], defaultImport: false }
    h = h.replace(/^type\s+/, '')
    const names = []
    let defaultImport = false
    const dm = h.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/)
    if (dm) {
        defaultImport = true
        h = h.slice(dm[0].length)
    }
    const brace = h.match(/\{([\s\S]*)\}/)
    if (brace) {
        for (const part of brace[1].split(',')) {
            let t = part.trim()
            if (!t) continue
            t = t.replace(/^type\s+/, '')
            const name = t.includes(' as ') ? t.split(' as ')[0].trim() : t
            // 允许字符串字面量导出名（`{ 'a-b' as c }`）时跳过，非常规
            if (isIdentStart(name[0]) && /^[A-Za-z_$][\w$]*$/.test(name)) names.push(name)
        }
    }
    return { names, defaultImport }
}

/** 收集 `export {}` / `export {} from` 的**导出名**（`as` 右侧） */
const braceExportNames = (group) => {
    const out = []
    for (const part of group.split(',')) {
        let t = part.trim()
        if (!t) continue
        t = t.replace(/^type\s+/, '')
        const name = t.includes(' as ') ? t.split(' as ').pop().trim() : t
        if (/^[A-Za-z_$][\w$]*$/.test(name)) out.push(name)
    }
    return out
}

// ---------------------------------------------------------------------------
// 模块解析
// ---------------------------------------------------------------------------

/** 包名 → 包根目录（扫描 packages/* 与 apps/*） */
const buildPackageMap = () => {
    const map = new Map()
    for (const group of ['packages', 'apps']) {
        const dir = join(ROOT, group)
        if (!existsSync(dir)) continue
        for (const entry of readdirSync(dir)) {
            const pj = join(dir, entry, 'package.json')
            if (!existsFile(pj)) continue
            try {
                const name = JSON.parse(readFile(pj)).name
                if (name) map.set(name, join(dir, entry))
            } catch {
                /* 忽略损坏的 package.json */
            }
        }
    }
    return map
}

const PKG_MAP = buildPackageMap()

/** 给定基路径，按 RESOLVE_EXTS 与 index.* 解析为真实文件 */
const resolveFile = (base) => {
    if (existsFile(base)) return base
    for (const ext of RESOLVE_EXTS) if (existsFile(base + ext)) return base + ext
    // TS ESM 惯例：`import './x.js'` 实际源码是 `./x.ts` / `./x.tsx`
    const tsExt = base.match(/\.(?:js|mjs|cjs)$/)
    if (tsExt) {
        const stem = base.slice(0, -tsExt[0].length)
        for (const ext of RESOLVE_EXTS) if (existsFile(stem + ext)) return stem + ext
    }
    for (const ext of RESOLVE_EXTS) {
        const p = join(base, 'index' + ext)
        if (existsFile(p)) return p
    }
    return null
}

/** 将模块说明符解析为磁盘文件；无法解析返回 null */
const resolveSpecifier = (spec, fromFile) => {
    if (spec.startsWith('.')) return resolveFile(resolve(dirname(fromFile), spec))
    if (!spec.startsWith('@nao-todo/')) return null
    const segments = spec.split('/')
    const pkgName = segments.slice(0, 2).join('/')
    const pkgDir = PKG_MAP.get(pkgName)
    if (!pkgDir) return null
    const rest = segments.slice(2).join('/')
    if (!rest) {
        const pj = join(pkgDir, 'package.json')
        if (existsFile(pj)) {
            try {
                const main = JSON.parse(readFile(pj)).main
                if (main) {
                    const r = resolveFile(join(pkgDir, main))
                    if (r) return r
                }
            } catch {
                /* 忽略 */
            }
        }
        return resolveFile(join(pkgDir, 'index'))
    }
    return resolveFile(join(pkgDir, rest))
}

// ---------------------------------------------------------------------------
// 导出符号表
// ---------------------------------------------------------------------------

const exportCache = new Map()

/** 计算某个文件的导出符号集合（递归展开 `export * from`，含环检测） */
const moduleExports = (file, visiting = new Set()) => {
    if (exportCache.has(file)) return exportCache.get(file)
    const out = new Set()
    exportCache.set(file, out)
    if (visiting.has(file)) return out
    visiting.add(file)

    if (file.endsWith('.vue')) out.add('default')

    const code = stripComments(readFile(file))

    // export default ...
    if (/\bexport\s+default\b/.test(code)) out.add('default')

    // export * as ns from '...'（含 TS 5.0 `export type * as ns from`）
    for (const m of code.matchAll(
        /export\s+(?:type\s+)?\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"]/g
    )) {
        out.add(m[1])
    }

    // export * from '...'（展开全部命名导出，不含 default；含 `export type * from`）
    for (const m of code.matchAll(/export\s+(?:type\s+)?\*\s+from\s*['"]([^'"]+)['"]/g)) {
        const target = resolveSpecifier(m[1], file)
        if (target) for (const n of moduleExports(target, visiting)) out.add(n)
    }

    // export { A, B as C } from '...' / export type { ... } from '...'（导出名 = as 右侧）
    for (const m of code.matchAll(
        /export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
    )) {
        for (const n of braceExportNames(m[1])) out.add(n)
    }

    // export { A, B as C }（局部形式，含 `export type { X }`）——排除带 from 的再导出
    for (const m of code.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}(?!\s*from)/g)) {
        for (const n of braceExportNames(m[1])) out.add(n)
    }

    // 声明式导出
    for (const m of code.matchAll(
        /export\s+(?:default\s+|async\s+|abstract\s+|declare\s+)*(?:const|let|var|function|class|enum|interface|type)\s*\*?\s*([A-Za-z_$][\w$]*)/g
    )) {
        out.add(m[1])
    }

    visiting.delete(file)
    return out
}

// ---------------------------------------------------------------------------
// 扫描全仓
// ---------------------------------------------------------------------------

const collectSourceFiles = () => {
    const files = []
    const walk = (dir) => {
        for (const entry of readdirSync(dir)) {
            if (IGNORE_DIRS.has(entry)) continue
            const p = join(dir, entry)
            let st
            try {
                st = statSync(p)
            } catch {
                continue
            }
            if (st.isDirectory()) {
                walk(p)
            } else if (SOURCE_EXTS.some((ext) => entry.endsWith(ext))) {
                files.push(p)
            }
        }
    }
    walk(ROOT)
    return files
}

const files = collectSourceFiles()
const errors = []
let checkedStatements = 0
let checkedNames = 0

for (const file of files) {
    const rel = relative(ROOT, file)
    const src = readFile(file)
    for (const stmt of scanStatements(src)) {
        if (!stmt.spec.startsWith('@nao-todo/')) continue
        if (stmt.sideEffect) continue
        const target = resolveSpecifier(stmt.spec, file)
        if (!target) {
            errors.push(`${rel}: 模块无法解析 -> ${stmt.spec}`)
            continue
        }
        const avail = moduleExports(target)
        const { names, defaultImport } = parseHeader(stmt.header)
        checkedStatements += 1
        if (defaultImport) {
            checkedNames += 1
            if (!avail.has('default')) errors.push(`${rel}: default 导入不存在 -> ${stmt.spec}`)
        }
        for (const name of names) {
            checkedNames += 1
            if (!avail.has(name)) errors.push(`${rel}: "${name}" 不在 ${stmt.spec}`)
        }
    }
}

console.log(
    `[guard:barrel-imports] 扫描 ${files.length} 文件 · 校验 ${checkedStatements} 条 @nao-todo 导入 / ${checkedNames} 个命名`
)
if (errors.length > 0) {
    console.error(`[guard:barrel-imports] 未解析导入 ${errors.length} 处：`)
    errors.forEach((line) => console.error('  - ' + line))
    process.exit(1)
}
console.log('[guard:barrel-imports] OK - 全仓 @nao-todo/* 命名导入（含 type-only）均可解析')
