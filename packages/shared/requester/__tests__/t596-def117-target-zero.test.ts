/// <reference types="node" />
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

/**
 * T596 红基线 —— AC8：`DEF-117` 棘轮**目标值**归零（测试内源码扫描，≈0.1s）
 *
 * 与 `auth-seam-scan.test.ts` 的**棘轮**分工：
 * - 棘轮（既有文件，冻结值 61 / 5）只负责「不变多」，**常量由 rd-fe 在清偿时下调**（本文件不改它）；
 * - 本文件断言**目标值本身**：清偿完成后必须真的为 **0**（棘轮停了但没清干净 ⇒ 本文件红）。
 *
 * 判据（只扫**非测试**源码；排除移动端红线 `apps/mobile` / `packages/presentation-react`）：
 * - `packages/infrastructure/src/persistence-go/**`：内联 `` `Bearer ${…}` `` = **0** 处
 *   （改用 `buildAuthHeaders(...)` 或请求器统一注入）；
 * - `packages/shared/requester/**`（**`auth-headers.ts` 唯一实现处**、**`lynx.ts` 例外** 之外）= **0** 处；
 * - `lynx.ts`：**保留 1 处**（Lynx 运行时 token 必填；归零需**移动端授权**）⇒ 本文件守护「不得被顺手
 *   清零/改语义」，并断言棘轮文件仍单列它（防守卫被无声删除）；
 * - 全仓非测试源码：`(===|!==|==|!=) 1004[12]` 字面量比较 = **0** 处（改走 `isCredentialCode` /
 *   `decideSessionEnd`；集合定义 / 数组字面量不计入，口径同棘轮。T600：与棘轮同步覆盖同族
 *   两个凭证码 `10041` / `10042`）。
 *
 * 状态：**红**（persistence-go 61 处、`=== 10041` 5 处）。
 * 变异易感：清偿时复活任意一处拼接 / 字面量比较 ⇒ 对应断言红。
 */

const REPO_ROOT = (() => {
    let dir = dirname(new URL(import.meta.url).pathname)
    for (let i = 0; i < 8; i += 1) {
        if (existsSync(join(dir, 'apps/web/src')) && existsSync(join(dir, 'packages'))) return dir
        dir = dirname(dir)
    }
    throw new Error('无法定位仓库根（期望存在 apps/web/src 与 packages）')
})()

const SCAN_ROOTS = ['apps/web/src', 'apps/desktop/src', 'packages']
const SKIP_DIRS = new Set([
    'node_modules',
    'dist',
    'out',
    '__tests__',
    '.git',
    '.codegraph',
    'coverage',
    '.pi'
])
const SKIP_PATHS = ['apps/mobile', 'packages/presentation-react']
const SOURCE_EXT = ['.ts', '.vue']

/** `Bearer` 拼接在 `shared/requester` 内的合法出现处 */
const BEARER_ALLOWED_FILES = new Set(['auth-headers.ts', 'lynx.ts'])
/** `lynx.ts` 的保留处数（ADR D6 已知边界：token 必填；归零需移动端授权） */
const LYNX_BEARER_SITES = 1

type SourceFile = { path: string; text: string }

const isSkippedPath = (path: string): boolean =>
    SKIP_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))

const walk = (absDir: string, out: string[]): void => {
    for (const entry of readdirSync(absDir)) {
        const abs = join(absDir, entry)
        const rel = relative(REPO_ROOT, abs)
        if (isSkippedPath(rel)) continue
        const stat = statSync(abs)
        if (stat.isDirectory()) {
            if (SKIP_DIRS.has(entry)) continue
            walk(abs, out)
            continue
        }
        if (!SOURCE_EXT.some((ext) => entry.endsWith(ext))) continue
        if (/\.(test|spec)\.[^.]+$/.test(entry)) continue
        if (entry.endsWith('.d.ts')) continue
        out.push(abs)
    }
}

const readSources = (roots: string[]): SourceFile[] => {
    const paths: string[] = []
    for (const root of roots) {
        const abs = join(REPO_ROOT, root)
        if (!existsSync(abs)) continue
        if (statSync(abs).isDirectory()) walk(abs, paths)
        else paths.push(abs)
    }
    return paths.map((abs) => ({
        path: relative(REPO_ROOT, abs).split('\\').join('/'),
        text: readFileSync(abs, 'utf8')
    }))
}

const basename = (path: string): string => path.slice(path.lastIndexOf('/') + 1)
const isCommentLine = (line: string): boolean => /^\s*(\*|\/\/|\/\*)/.test(line)

const countCodeOccurrences = (
    sources: SourceFile[],
    pattern: RegExp
): { total: number; rows: { path: string; hits: number }[] } => {
    const rows = sources
        .map((file) => ({
            path: file.path,
            hits: file.text
                .split(/\r?\n/)
                .filter((line) => !isCommentLine(line))
                .filter((line) => pattern.test(line)).length
        }))
        .filter((row) => row.hits > 0)
    return { total: rows.reduce((sum, row) => sum + row.hits, 0), rows }
}

const formatRows = (rows: { path: string; hits: number }[]): string =>
    rows.map((row) => `${row.path}(${row.hits})`).join('、')

const BEARER_TEMPLATE = /Bearer \$\{/
/** 凭证码「比较」字面量（口径同 `auth-seam-scan.test.ts`：只认比较，不认集合定义） */
/** T600：与 `auth-seam-scan` 棘轮同口径 —— 覆盖 `10041`/`10042` 两个同族码、含松散比较 */
const CREDENTIAL_LITERAL_COMPARISON = /(===|!==|==|!=)\s*1004[12]\b/

describe('AC8：`Bearer` 拼接只剩单点（persistence-go 0 处）', () => {
    it('persistence-go/** 内联 `Bearer ${…}` = 0 处（改走 buildAuthHeaders / 统一注入）', () => {
        const sources = readSources(['packages/infrastructure/src/persistence-go'])
        const { total, rows } = countCodeOccurrences(sources, BEARER_TEMPLATE)
        expect(
            total,
            `AC8/DEF-117：persistence-go 仍有 ${total} 处拼接 ⇒ 应改指 shared/requester 的 buildAuthHeaders；现状：${formatRows(rows)}`
        ).toBe(0)
    })

    it('shared/requester（auth-headers.ts / lynx.ts 除外）= 0 处', () => {
        const sources = readSources(['packages/shared/requester'])
        const { total, rows } = countCodeOccurrences(sources, BEARER_TEMPLATE)
        const offenders = rows.filter((row) => !BEARER_ALLOWED_FILES.has(basename(row.path)))
        expect(
            offenders.map((row) => `${row.path}(${row.hits})`).join('、'),
            `除 auth-headers.ts（唯一实现）/ lynx.ts（待授权例外）外不得拼接：${formatRows(offenders)}`
        ).toBe('')
        expect(total, `现状：${formatRows(rows)}`).toBeGreaterThanOrEqual(LYNX_BEARER_SITES)
    })

    it('lynx.ts 保留 1 处（移动端授权缺口，不得被顺手清零/改语义）', () => {
        const sources = readSources(['packages/shared/requester'])
        const { rows } = countCodeOccurrences(sources, BEARER_TEMPLATE)
        const lynxHits =
            rows.find((row) => row.path.endsWith('shared/requester/lynx.ts'))?.hits ?? 0
        expect(
            lynxHits,
            'lynx.ts 的 Bearer 拼接是 ADR D6 已登记边界（归零需移动端授权）⇒ 本批保持 1 处'
        ).toBe(LYNX_BEARER_SITES)
    })

    it('棘轮仍单列 lynx.ts（守卫不得被无声删除）', () => {
        const ratchet = readFileSync(
            join(REPO_ROOT, 'packages/shared/requester/__tests__/auth-seam-scan.test.ts'),
            'utf8'
        )
        expect(ratchet, 'auth-seam-scan 必须继续单列 lynx.ts 例外').toContain('lynx.ts')
    })
})

describe('AC8：凭证码字面量比较 = 0 处（改走 isCredentialCode / decideSessionEnd）', () => {
    it('全仓非测试源码 `1004[12]` 类比较 = 0 处（含 `10042` 同族码）', () => {
        const sources = readSources(SCAN_ROOTS)
        const { total, rows } = countCodeOccurrences(sources, CREDENTIAL_LITERAL_COMPARISON)
        expect(
            total,
            `AC8/DEF-117：仍有 ${total} 处字面量比较（10041/10042 同族，含 lynx.ts）⇒ 应改 isCredentialCode；现状：${formatRows(rows)}`
        ).toBe(0)
    })
})