/// <reference types="node" />
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import { prioritySNMap, prioritySNMapReverse } from '@nao-todo/domain-task'

/**
 * T603 红基线 —— AC7：优先级判据单一来源（`DEF-113` / PRD R4）
 *
 * 现状：`packages/shared/utils/task-attributes-parser.ts` 的 `parseTaskPriority` 是**第二份三档 switch**
 * （`low/medium/high`，缺 `urgent`）⇒ 若未来被接线，`urgent` 会解析成 `0`（与 `DEF-84` 同源复发）。
 *
 * AC7 允许两种收口：**删除死件**（须给 0 调用点证据）或 **改为复用 `prioritySNMap`**。
 * 本用例对两种收口都成立：
 * - 删了 ⇒ 源码无 `parseTaskPriority` 声明、行为用例自动跳过、调用点扫描 0；
 * - 留了 ⇒ 不得再有 `switch`/硬编码三档，且 `urgent` 必须与 domain 同源。
 *
 * 状态：**红**（存在第二份三档 switch；`urgent` 解析为 0）。「0 调用点」当前为绿。
 */

const REPO_ROOT = (() => {
    let dir = dirname(new URL(import.meta.url).pathname)
    for (let i = 0; i < 8; i += 1) {
        if (existsSync(join(dir, 'apps/web/src')) && existsSync(join(dir, 'packages'))) return dir
        dir = dirname(dir)
    }
    throw new Error('无法定位仓库根（期望存在 apps/web/src 与 packages）')
})()

const PARSER_PATH = 'packages/shared/utils/task-attributes-parser.ts'
const SKIP_DIRS = new Set([
    'node_modules',
    'dist',
    'out',
    'coverage',
    '.git',
    '.codegraph',
    '__tests__',
    '.pi'
])
const SKIP_PATHS = ['apps/mobile', 'packages/presentation-react']
const SOURCE_EXT = ['.ts', '.vue']

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
        out.push(rel)
    }
}

const readSource = (path: string): string => readFileSync(join(REPO_ROOT, path), 'utf-8')

/** 去掉注释行（调用点证据不能被注释里的示例污染） */
const stripCommentLines = (text: string): string =>
    text
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map((line) => line.replace(/\/\/.*$/, ''))
        .join('\n')

/**
 * 取 `parseTaskPriority` 声明原文（到下一个顶层 `export` 为止）
 * @returns `null` = 已删除（AC7 的合法收口之一）
 */
const parseTaskPriorityDeclaration = (source: string): string | null => {
    const start = source.search(/export\s+const\s+parseTaskPriority\b/)
    if (start < 0) return null
    const rest = source.slice(start + 10)
    const nextExport = rest.search(/\nexport\s/)
    return nextExport < 0 ? rest : rest.slice(0, nextExport)
}

describe('T603 AC7 · `parseTaskPriority` 不得是第二份三档判据', () => {
    const source = readSource(PARSER_PATH)
    const declaration = parseTaskPriorityDeclaration(source)

    it('AC7① 已删除，或复用 `prioritySNMap`（不得再有 switch / 硬编码三档）', () => {
        if (declaration === null) {
            // 收口 = 删除死件（AC7 允许）；调用点证据见 AC7③
            return
        }
        expect(
            declaration,
            `实测声明原文：\n${declaration}\n（第二份三档 switch 违 R4「判据单点」）`
        ).not.toMatch(/\bswitch\s*\(/)
        expect(declaration).toMatch(/prioritySNMap/)
        expect(declaration).not.toMatch(/case\s+'(low|medium|high)'/)
    })

    it('AC7② 若仍导出：`urgent` 必须与 domain `prioritySNMap` 同源（不得解析为 0）', async () => {
        const module = (await import('../task-attributes-parser')) as Record<string, unknown>
        const parse = module['parseTaskPriority']
        if (typeof parse !== 'function') return

        const parsePriority = parse as (value: string) => number
        expect(parsePriority('urgent'), 'urgent 应解析为 prioritySNMap.urgent').toBe(
            prioritySNMap.urgent
        )
        expect(parsePriority('high')).toBe(prioritySNMap.high)
        expect(prioritySNMapReverse[parsePriority('urgent')]).toBe('urgent')
    })

    it('AC7③ 删除证据：全仓非测试源码 0 处调用 `parseTaskPriority(`', () => {
        const files: string[] = []
        walk(join(REPO_ROOT, 'apps'), files)
        walk(join(REPO_ROOT, 'packages'), files)
        // 上面两次 walk 的路径都以相对仓库根的路径累积；去重防 apps/packages 交叉
        const unique = [...new Set(files)]

        const callPattern = /\bparseTaskPriority\s*\(/g
        const offenders: { path: string; hits: number }[] = []
        for (const path of unique) {
            if (path === PARSER_PATH) continue
            const text = stripCommentLines(readSource(path))
            const hits = text.match(callPattern)?.length ?? 0
            if (hits > 0) offenders.push({ path, hits })
        }

        expect(
            offenders,
            `存在调用点 ⇒ 不能按「死件删除」收口：${JSON.stringify(offenders)}`
        ).toEqual([])
    })
})