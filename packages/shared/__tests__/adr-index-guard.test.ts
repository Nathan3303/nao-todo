/// <reference types="node" />
import { describe, expect, it } from 'vite-plus/test'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * ADR 归档索引结构守卫（Issue #394 / DEF-165）
 *
 * @description `docs/adr/README.md` 曾发生**整篇被追加第二份副本**的事故：文件里出现两遍
 *              `# ADR 归档索引` 与两套小节（`篇间关系` / `待拍板事项跟踪` / `计划中的偏离登记` / `遗留登记`），
 *              且两份内容**互有独有行**（T733/T672 只在第一份，T696/T673 只在第二份）⇒ 直接截断任一份都会丢行。
 *              本用例把「结构唯一 + 无重复行 + 链接可达」做成可拦的失败，防再次整篇追加。
 *
 * @remarks 放 `packages/shared`（⛔ 不放 `apps/web`）：本文件用 `node:fs`，而 `apps/web` 的 tsconfig
 *          program 一旦引入 `node:*` 会把 `@types/node` 全局漏进去，令无关文件 `setTimeout` 报 `TS2322`（PR #365 踩过）。
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../../..')
const ADR_DIR = join(REPO_ROOT, 'docs/adr')
const INDEX = join(ADR_DIR, 'README.md')

const SECTION_TITLES = [
    '## 篇间关系',
    '## 待拍板事项跟踪',
    '## 计划中的偏离登记（有据偏离，已批准）',
    '## 遗留登记（跨篇）'
]

const read = (): string => readFileSync(INDEX, 'utf8')

const lines = (): string[] => read().replace(/\r\n/g, '\n').split('\n')

/** ADR 表行（`| YYYY-MM-DD | … |` 且在首个 `## ` 之前） */
const tableRows = (): string[] => {
    const all = lines()
    const firstSection = all.findIndex((line) => line.startsWith('## '))
    const head = firstSection === -1 ? all : all.slice(0, firstSection)
    return head.filter((line) => line.startsWith('| 2026-')).map((line) => line.trim())
}

describe('docs/adr/README.md 结构守卫（DEF-165）', () => {
    it('恰有一个文档标题（防整篇重复追加）', () => {
        const titles = lines().filter((line) => line.trim() === '# ADR 归档索引')
        expect(titles).toHaveLength(1)
    })

    it('四个二级章节各出现恰一次', () => {
        const all = lines().map((line) => line.trim())
        for (const title of SECTION_TITLES) {
            expect(all.filter((line) => line === title)).toHaveLength(1)
        }
    })

    it('ADR 表行无重复（按整行文本）', () => {
        const rows = tableRows()
        expect(rows.length).toBeGreaterThanOrEqual(30)
        expect(new Set(rows).size).toBe(rows.length)
    })

    it('表格里引用的 ADR 文件全部存在', () => {
        const missing: string[] = []
        for (const line of tableRows()) {
            for (const match of line.matchAll(/\]\((20\d\d-\d\d-\d\d-[a-z0-9-]+\.md)\)/g)) {
                const file = match[1]
                if (!existsSync(join(ADR_DIR, file))) missing.push(file)
            }
        }
        expect(missing).toEqual([])
    })

    it('近两批新增的 ADR 行都在表里（防再次截断丢行）', () => {
        const rows = tableRows().join('\n')
        for (const marker of ['T733', 'T696', 'T673', 'T672']) {
            expect(rows).toContain(marker)
        }
    })
})