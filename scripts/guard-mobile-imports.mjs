/**
 * 移动端 import 守卫（禁 persistence-local / persistence-sync）
 * @description 静态断言 `packages/presentation-react/**` 与 `apps/mobile/**` 的 import 说明符
 * **不含** `persistence-local` / `persistence-sync`（含深路径 / 层子路径 / 相对路径等一切形式）。
 *
 * 背景（ADR `docs/adr/2026-09-23-barrel-import-surface-narrowing.md` §5.3 / §7-D5）：
 * `persistence-local`（Dexie + 26 个本地仓储模块）一旦被移动端（ReactLynx / `apps/mobile`）
 * 可达，会把 Dexie 拖进 Lynx 产物 ⇒ 踩「移动端红线」。现状靠约定保证，本守卫将其固化为门禁。
 *
 * 覆盖：
 *  1. 静态 `import ... from '...'` / 副作用式 `import '...'` / 再导出 `export ... from '...'`；
 *  2. 动态 `import('...')` 与 `require('...')`；
 *  3. `.ts` / `.tsx` / `.vue` / `.mjs` / `.js` / `.mts` / `.cts`（注释已剥离，避免注释误伤）；
 *  4. 扫描根不存在或扫到 0 文件 ⇒ 显式失败（防守卫本身空转）。
 *
 * 用途：CI / 提交前手动跑 `pnpm guard:mobile-imports`。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const ROOTS = ['packages/presentation-react', 'apps/mobile']
const SOURCE_EXTS = ['.ts', '.tsx', '.vue', '.mjs', '.js', '.mts', '.cts']
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'out', 'build', 'coverage', '.git', '.vite-hooks'])
/** 移动端红线：这些模块（Dexie / 本地仓储）不得被移动端可达代码引用 */
const BANNED = ['persistence-local', 'persistence-sync']
/** `from '<spec>'` / `import '<spec>'` / `import('<spec>')` / `require('<spec>')` */
const SPECIFIER_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(['"])([^'"]+)\1/g

/** 剥离注释（保留字符串字面量），避免注释里的示例文本造成误报 */
const stripComments = (src) => {
    let out = ''
    let i = 0
    const n = src.length
    while (i < n) {
        const c = src[i]
        if (c === '"' || c === "'" || c === '`') {
            const quote = c
            out += c
            i += 1
            while (i < n) {
                if (src[i] === '\\') {
                    out += src.slice(i, i + 2)
                    i += 2
                    continue
                }
                out += src[i]
                if (src[i] === quote) {
                    i += 1
                    break
                }
                i += 1
            }
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

const offenders = []
let scanned = 0

const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
        if (IGNORE_DIRS.has(entry)) continue
        const p = join(dir, entry)
        if (statSync(p).isDirectory()) {
            walk(p)
            continue
        }
        if (!SOURCE_EXTS.some((ext) => entry.endsWith(ext))) continue
        scanned += 1
        const text = stripComments(readFileSync(p, 'utf8'))
        for (const m of text.matchAll(SPECIFIER_RE)) {
            const spec = m[2]
            const hit = BANNED.find((b) => spec.includes(b))
            if (hit) {
                const line = text.slice(0, m.index).split('\n').length
                offenders.push(`${p}:${line}: 移动端引用 ${hit} → '${spec}'`)
            }
        }
    }
}

for (const root of ROOTS) {
    if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
        offenders.push(`${root}: 扫描根不存在（守卫会空转，拒绝）`)
        continue
    }
    walk(root)
}
if (scanned === 0) offenders.push(`扫描到 0 个源文件（守卫会空转，拒绝）`)

if (offenders.length > 0) {
    console.error('[guard:mobile-imports] 移动端红线违反（禁 persistence-local / persistence-sync）：')
    offenders.forEach((line) => console.error('  - ' + line))
    process.exit(1)
}
console.log(
    `[guard:mobile-imports] OK - ${ROOTS.join(' / ')} 共 ${scanned} 个源文件，未引用 ${BANNED.join(' / ')}`
)
