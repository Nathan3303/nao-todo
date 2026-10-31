/// <reference types="node" />
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

/**
 * T608 AC7 —— `parseTaskPriorityBackward` + `prioritySNMapReverse` **成对清除或均有真实消费者**
 * （`DEF-125` · PRD `2026-10-31-kanban-priority-grouping.md` AC7）
 *
 * @description 背景：`DEF-113` 删掉 `parseTaskPriority` 后，反查函数
 *              `parseTaskPriorityBackward`（`packages/shared/utils/task-attributes-parser.ts`）仍导出但
 *              **0 调用方**，且是 `prioritySNMapReverse`（`packages/domain-task/src/domain/constants.ts`）
 *              的**唯一非测试消费者** ⇒ 二者构成一对「只为彼此存在」的死件。
 *
 * 断言口径（「导出符号 + 引用计数」，不是只 grep 一个名字）：
 *   ① **成对**：两个符号的「仍导出」状态必须一致（要么都删，要么都留）；
 *   ② 留 ⇒ **各自**必须有真实消费者：非测试、非声明文件、**非纯再导出**（barrel 不算消费者）；
 *   ③ 反「互相续命」：不得出现「parser 0 消费者 **且** mapReverse 只被 parser 消费」。
 *
 * 两种合法收口都能绿：**成对删除**（两条 ①② 空过）或**补真实消费者**。
 *
 * 状态：**红**（今日两者都导出，parser 消费者 = 0，mapReverse 消费者 = 仅 parser）。
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
const REVERSE_MAP_PATH = 'packages/domain-task/src/domain/constants.ts'

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
/** 移动端红线目录：不参与本仓源码扫描（也不应消费这两个内部工具） */
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

const SOURCE_FILES = (() => {
    const out: string[] = []
    for (const root of ['packages', 'apps']) walk(join(REPO_ROOT, root), out)
    return out.sort()
})()

const readSource = (path: string): string => readFileSync(join(REPO_ROOT, path), 'utf-8')

/** 去注释（避免注释里的示例/Doc 提及被算成消费者） */
const stripComments = (text: string): string =>
    text
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map((line) => line.replace(/\/\/.*$/, ''))
        .join('\n')

/** 只做再导出的 barrel 语句不算「真实消费者」 */
const stripReExports = (text: string): string =>
    text.replace(/export\s*\{[^}]*\}\s*(from\s*[^\n]+)?/g, '')

const SOURCES = new Map<string, string>(SOURCE_FILES.map((path) => [path, readSource(path)]))

const wordRe = (name: string): RegExp => new RegExp(`\\b${name}\\b`)

/** 声明/导出该符号的文件（支持 `export const|function|type|class` 与 `export { X }`） */
const declarers = (name: string): string[] =>
    SOURCE_FILES.filter((path) => {
        const source = stripComments(SOURCES.get(path) ?? '')
        return (
            new RegExp(`export\\s+(?:const|let|var|function|type|class)\\s+${name}\\b`).test(
                source
            ) || new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(source)
        )
    })

/** 真实消费者（排除：测试、声明文件、纯再导出 barrel） */
const consumers = (name: string): string[] => {
    const declaredIn = new Set(declarers(name))
    return SOURCE_FILES.filter((path) => {
        if (declaredIn.has(path)) return false
        const source = stripReExports(stripComments(SOURCES.get(path) ?? ''))
        return wordRe(name).test(source)
    })
}

const SYMBOL = {
    parse: 'parseTaskPriorityBackward',
    map: 'prioritySNMapReverse'
} as const

const report = (): string =>
    JSON.stringify(
        {
            [SYMBOL.parse]: {
                declarers: declarers(SYMBOL.parse),
                consumers: consumers(SYMBOL.parse)
            },
            [SYMBOL.map]: {
                declarers: declarers(SYMBOL.map),
                consumers: consumers(SYMBOL.map)
            }
        },
        null,
        2
    )

describe('T608 AC7 · 优先级反查函数与反向映射不得是「只为彼此存在」的死件', () => {
    it('AC7① 两个符号的导出状态成对（要么都删，要么都留）', () => {
        const parseExported = declarers(SYMBOL.parse).length > 0
        const mapExported = declarers(SYMBOL.map).length > 0
        expect(
            parseExported,
            `导出状态不成对（「成对清除」是 PRD 允许的收口）：实测 ${report()}`
        ).toBe(mapExported)
    })

    it('AC7② 若仍导出 ⇒ 各自必须有真实消费者（非测试 / 非声明文件 / 非 barrel 再导出）', () => {
        if (declarers(SYMBOL.parse).length === 0) return // 已删除：AC7① 已锁成对性

        for (const name of [SYMBOL.parse, SYMBOL.map] as const) {
            expect(
                consumers(name).length,
                `「${name}」仍导出但无真实消费者（死件）：实测 ${report()}`
            ).toBeGreaterThan(0)
        }
    })

    it('AC7③ 不得互相续命：parser 0 消费者时，mapReverse 不能只被 parser 消费', () => {
        if (declarers(SYMBOL.parse).length === 0) return

        const parseConsumers = consumers(SYMBOL.parse)
        const mapConsumers = consumers(SYMBOL.map)
        const mapOnlyForParser = mapConsumers.every((path) => path === PARSER_PATH)
        const mutuallyDead = parseConsumers.length === 0 && mapOnlyForParser

        expect(mutuallyDead, `「只为彼此存在」的死件对仍存在：实测 ${report()}`).toBe(false)
    })

    it('AC7④ 声明位置仍可定位（用例不因文件搬迁而静默空过）', () => {
        // 若整组被清除，两个声明文件仍应是合法源码路径（防路径写错导致扫描恒 0）
        expect(existsSync(join(REPO_ROOT, PARSER_PATH)), `缺文件 ${PARSER_PATH}`).toBe(true)
        expect(existsSync(join(REPO_ROOT, REVERSE_MAP_PATH)), `缺文件 ${REVERSE_MAP_PATH}`).toBe(
            true
        )
        // 扫描面非空（防 walk 失效导致「0 引用 ⇒ 假绿」）
        expect(SOURCE_FILES.length, '源码扫描面异常为空').toBeGreaterThan(500)
    })
})