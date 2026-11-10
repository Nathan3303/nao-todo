/// <reference types="vite/client" />
import { describe, expect, it } from 'vite-plus/test'

/**
 * T675 / M1 基准捕获 · **直写点源级断言**（ADR §四-5 / §八 R-9）
 *
 * 字段级合并的前提是「我改过哪些字段 + 这些字段的旧值」（`fieldBase`）。它只在**本地写路径**可得，
 * 因此每个绕过 `putWithSyncBase*` 的 `syncTracker.markDirty(...)` 直写点**必须**自己捕获并传入基准；
 * 漏一个 ⇒ 该路径退化为今日整行冲突（不丢数据，但 AC1 在该路径不成立）。
 *
 * 本用例是**源级护栏**（不是行为断言；jsdom 无跨路径行为可断言面）：
 * - 直写点清单 = **允许清单 ∪ 显式豁免清单**（**新增直写点即红**，必须显式评估是否需要 `fieldBase`）；
 * - 每个**允许清单**内的直写点都必须出现 `fieldBase`（参数位由 M1 定，位置不限）；
 * - 豁免点必须逐条登记理由（PM 2026-11-10 裁定：M1 接线范围 = **tasks 相关 3 文件 4 处**；
 *   `pomodoroRecords` 属非 `tasks` 实体（PRD `R-8`）⇒ **不接**，由后续实体批次接入）。
 *
 * 现状红因：全部直写点都没有字段级基准（`put-with-sync-base.ts` 只回填行级 `syncedServerUpdatedAt`）。
 * 已知直写点（2026-11-10 实测 5 处 / 4 文件）：需接 `fieldBase` 的 **4 处** =
 * `put-with-sync-base.ts`(1) · `project-archive-cascade.ts`(2) · `task-repo-impl.ts` `unarchive`(1)；
 * 显式豁免 **1 处** = `pomodoro-record-repo-impl.ts`(1)。
 *
 * 手法：`import.meta.glob(?raw)`（同 `packages/presentation/.../def-129-clearable-padding.test.ts`）。
 * ⛔ 不用 `node:fs` —— 在本包引入 `@types/node` 会把 `setTimeout` 全局返回类型染成 `Timeout`，
 * 令 `t654/t655/t657`（自绘假定时器）整片报 TS 错（2026-11-10 实测）。
 */
const sources = import.meta.glob(
    ['/packages/infrastructure/src/**/*.ts', '!/packages/infrastructure/src/**/__tests__/**'],
    { query: '?raw', import: 'default', eager: true }
) as Record<string, string>

/** 允许清单 = **必须**捕获并传入 `fieldBase` 的直写点（唯一 `markDirty` 定义处 `sync-tracker.ts` 不算调用点） */
const ALLOWED_FILES = [
    '/packages/infrastructure/src/persistence-local/repos/put-with-sync-base.ts',
    '/packages/infrastructure/src/persistence-local/repos/project-archive-cascade.ts',
    '/packages/infrastructure/src/persistence-local/repos/task-repo-impl.ts'
]

/**
 * 显式豁免的直写点（**只有**下面这些可以不捕获 `fieldBase`，且必须逐条给理由）
 * @description PM 2026-11-10 裁定：M1 接线范围 = tasks 相关 **3 文件 4 处**；番茄记录属非 `tasks`
 *              实体（PRD `R-8` 范围守卫）⇒ 本批不接（PRD 记「已知不关闭」，后续实体批次按同一
 *              helper 接入）。⛔ 新增直写点**不得**直接进本清单 —— 先进允许清单或先报 PM。
 */
const EXEMPT_FILES: ReadonlyArray<{ file: string; reason: string }> = [
    {
        file: '/packages/infrastructure/src/persistence-local/repos/pomodoro-record-repo-impl.ts',
        reason: 'pomodoroRecords 非 tasks 实体（R-8）；PRD 已知不关闭，后续实体批次接入'
    }
]

const EXEMPT_SET = new Set(EXEMPT_FILES.map((entry) => entry.file))

interface DirectWriteSite {
    file: string
    /** 1-based 行号 */
    line: number
    /** 整段调用文本（含参数） */
    call: string
}

/** 取 `markDirty(` 到配对右括号之间的文本（简单括号计数；本仓写点参数内无含括号的字面量） */
const extractCall = (source: string, openIndex: number): string => {
    let depth = 0
    for (let i = openIndex; i < source.length; i += 1) {
        const ch = source[i]
        if (ch === '(') depth += 1
        else if (ch === ')') {
            depth -= 1
            if (depth === 0) return source.slice(openIndex, i + 1)
        }
    }
    return source.slice(openIndex)
}

const collectSites = (): DirectWriteSite[] => {
    const sites: DirectWriteSite[] = []
    for (const [file, source] of Object.entries(sources)) {
        if (file.endsWith('/sync-tracker.ts')) continue
        const needle = 'syncTracker.markDirty('
        let from = 0
        for (;;) {
            const hit = source.indexOf(needle, from)
            if (hit < 0) break
            const openIndex = hit + needle.length - 1
            sites.push({
                file,
                line: source.slice(0, hit).split('\n').length,
                call: extractCall(source, openIndex)
            })
            from = hit + needle.length
        }
    }
    return sites
}

const SITES = collectSites()

describe('T675 / M1 直写点源级断言', () => {
    it('扫描面非空（防 glob 写错 ⇒ 恒真空转）', () => {
        const scanned = Object.keys(sources)
        expect(scanned.length).toBeGreaterThan(50)
        expect(SITES.length).toBe(5)
    })

    it('直写点清单 = 允许清单 ∪ 豁免清单（新增 markDirty 直写点即红，须评估 fieldBase）', () => {
        const expected = [...ALLOWED_FILES, ...EXEMPT_SET].sort()
        expect([...new Set(SITES.map((site) => site.file))].sort()).toEqual(expected)
    })

    it('豁免点仅限已裁定范围（不允许「顺手」扩大豁免）', () => {
        const exemptSites = SITES.filter((site) => EXEMPT_SET.has(site.file))
        expect(exemptSites.map((site) => site.file)).toEqual([
            '/packages/infrastructure/src/persistence-local/repos/pomodoro-record-repo-impl.ts'
        ])
        // 豁免理由必须写明依据（R-8 / 后续批次），防「无理由豁免」
        expect(EXEMPT_FILES.every((entry) => entry.reason.length > 10)).toBe(true)
    })

    it('允许清单内的每个直写点都捕获字段级基准（`fieldBase`）', () => {
        const offenders = SITES.filter(
            (site) => !EXEMPT_SET.has(site.file) && !site.call.includes('fieldBase')
        ).map((site) => `${site.file}:${site.line}`)
        expect(
            offenders,
            `以下直写点未捕获字段级基准（该路径会退化为整行冲突）：\n${offenders.join('\n')}`
        ).toEqual([])
    })
})