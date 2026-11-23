/// <reference types="node" />
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import {
    DARK_SWITCH,
    GRAPHIC_MIN,
    PAIRS,
    SOURCES,
    TEXT_MIN,
    THRESHOLD,
    auditContrast,
    evaluatePairs,
    loadThemeTokens
} from '../../../scripts/contrast-audit.mjs'

/**
 * 对比度守卫的 **CI 落点**（T760 / Issue #366）
 *
 * 背景：`guard:contrast` 原是只在本地跑的脚本（`pnpm run guard:contrast`），CI 里没有它 —— 主题
 * token 被改淡、pair 被悄悄删、阈值被改软，CI 都不会红。本用例把它接进既有 `test` job
 * （vitest），⛔ 不动 `.github/workflows/**`。
 *
 * 分工：脚本 `scripts/contrast-audit.mjs` 是**唯一事实来源**（阈值常量 / pair 表 / 求值器），
 * 本用例只调用它的导出，⛔ 不复制一份色值或阈值 —— 复制即双源，必然漂移。
 *
 * 三条防线（任一失效即红）：
 *  1. 真实主题 token 跑全部 pair ⇒ **0 条不达标**（现状 17 组全绿，见 CLI 输出）；
 *  2. **判据有牙**：注入一份坏 token 表 ⇒ 对应 pair 必须被逐条报出（解析失败也必须报，不许静默跳过）；
 *  3. 阈值常量与 pair 数被钉死 ⇒ 防「把 ±4.5 改软成 1.0」或「删 pair 让红变绿」。
 *
 * ⛔ 不放 `apps/web`：该 program 里出现 `node:*` 会把 `@types/node` 全局漏进去，令无关文件的
 * `setTimeout` 推导成 `NodeJS.Timeout`、`vp check` 报 `TS2322`（PR #365 教训）。
 */

/** 仓库根：向上找到同时含 `apps/web/src` 与 `packages` 的目录 */
const REPO_ROOT = (() => {
    let dir = dirname(new URL(import.meta.url).pathname)
    for (let i = 0; i < 8; i += 1) {
        if (existsSync(join(dir, 'apps/web/src')) && existsSync(join(dir, 'packages'))) return dir
        dir = dirname(dir)
    }
    throw new Error('无法定位仓库根（期望存在 apps/web/src 与 packages）')
})()

/** pair 表评估结果的一行（由 JS 脚本的 JSDoc 推导，⛔ 不在此另立一份结构） */
type ContrastRow = ReturnType<typeof evaluatePairs>[number]

const failuresOf = (rows: ContrastRow[]) =>
    rows
        .filter((row) => !row.ok)
        .map(
            (row) =>
                `${row.fg} on ${row.bg}: ${row.error ?? `${row.ratio?.toFixed(2)}:1 < ${row.min}`}`
        )

describe('guard:contrast —— DESIGN.md §2 验收阈值（CI 落点）', () => {
    it('阈值常量 = 文本 4.5 / 图形 3（防改软）', () => {
        expect(TEXT_MIN).toBe(4.5)
        expect(GRAPHIC_MIN).toBe(3)
        expect(THRESHOLD).toEqual({ text: TEXT_MIN, graphic: GRAPHIC_MIN })
    })

    it('pair 表 ≥17 组，且每行都是合法的 [kind, fg, bg, usage]（防悄悄删 pair）', () => {
        expect(PAIRS.length).toBeGreaterThanOrEqual(17)
        for (const pair of PAIRS) {
            expect(pair).toHaveLength(4)
            const [kind, fg, bg, usage] = pair
            expect(['text', 'graphic']).toContain(kind)
            expect(fg.startsWith('--nue-')).toBe(true)
            expect(bg.startsWith('--nue-')).toBe(true)
            expect(usage.length).toBeGreaterThan(0)
        }
    })

    it('色值来源仍是「主题包 → 本仓覆盖」两处（防静默换源）', () => {
        expect(SOURCES).toHaveLength(2)
        expect(SOURCES[1]).toBe('apps/web/src/themes/variables.css')
    })

    it('真实主题 token：全部 pair 达标，0 条不达标', () => {
        const tokens = loadThemeTokens({ root: REPO_ROOT })
        expect(tokens.has(DARK_SWITCH)).toBe(true)

        const rows = evaluatePairs(tokens, PAIRS, THRESHOLD)
        expect(rows).toHaveLength(PAIRS.length)
        expect(failuresOf(rows)).toEqual([])
    })

    it('判据有牙：注入坏 token（淡底改深）⇒ 该 pair 必须被报出不达标', () => {
        const tokens = new Map(loadThemeTokens({ root: REPO_ROOT }))
        // 「次要文字 on 淡底」的底色由 #e6e6e6 改深到 #9e9e9e ⇒ 对比度必然跌破 4.5
        tokens.set('--nue-primary-color-100', '#9e9e9e')

        const rows = evaluatePairs(tokens, PAIRS, THRESHOLD)
        const target = rows.find(
            (row) => row.fg === '--nue-secondary-text-color' && row.bg === '--nue-primary-color-100'
        )
        if (!target) throw new Error('pair 表里找不到「次要文字 on 淡底」这一组')

        expect(target.ok).toBe(false)
        expect(target.ratio).toBeDefined()
        expect(target.ratio).toBeLessThan(TEXT_MIN)
        expect(failuresOf(rows).length).toBeGreaterThanOrEqual(1)
    })

    it('判据有牙：无法精确解析的色值 ⇒ 出「解析失败」行，不静默跳过', () => {
        const tokens = new Map(loadThemeTokens({ root: REPO_ROOT }))
        tokens.set('--nue-error-color-10', 'color-mix(in oklch, red, blue)')

        const rows = evaluatePairs(tokens, PAIRS, THRESHOLD)
        const target = rows.find((row) => row.bg === '--nue-error-color-10')
        if (!target) throw new Error('pair 表里找不到以 --nue-error-color-10 为底的这一组')

        expect(target.ok).toBe(false)
        expect(target.error).toBeTruthy()
    })

    it('auditContrast 与 CLI 同源：真实主题 0 失败', () => {
        const { rows, failures } = auditContrast({ root: REPO_ROOT })
        expect(rows).toHaveLength(PAIRS.length)
        expect(failures).toHaveLength(0)
    })
})