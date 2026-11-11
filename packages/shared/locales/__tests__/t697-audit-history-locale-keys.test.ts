import { describe, expect, it } from 'vite-plus/test'
import zhCN from '../zh-CN'
import enUS from '../en-US'

/**
 * T697 · A 档审计日志「变更历史」面板文案键（R-7 / D2 / AC10 · **红基线**）
 *
 * 口径（PRD **R-7** `D2` 修正 / arch §9「零新 i18n 不可行」）：
 * - **字段名** 100% 复用既有 `sync.conflict.field.*`（40+ 人话标签）⇒ 本档**不新增字段标签键**；
 * - **面板框架文案** 允许新增 **≤13 个** i18n 键（超 13 ⇒ 报 PM，⛔ 不得静默超）；
 * - zh / en **双语言齐备**且键集合相同（`types.ts` 的 `LocaleMessages` 由 `vp check` 守护）；
 * - C 端「说人话」：⛔ 不得出现内部词（`fieldBase` / `revision` / `source` / `plain:` / `OCC` /
 *   四来源原始值），横幅/空态/来源/动作一律用户语言；
 * - 同一组内文案**互不相同**（三态/多来源靠「颜色 + 符号 + 文字」三重冗余 ⇒ 文字必须可区分）。
 * @see docs/prds/2026-11-10-audit-log.md（R-7 / AC3 / AC10）
 * @see docs/reports/T696-audit-log-arch-review.md（§9 最小键集 13 × 2 语言）
 */

/** 最小键集（arch §9 冻结；实现可改名，但必须同批同步本数组并在回执里列出） */
const PANEL_KEYS = [
    'history.title',
    'history.empty',
    'history.loadFailed',
    'history.more',
    'history.source.local',
    'history.source.pull',
    'history.source.pushMerge',
    'history.source.conflictRetry',
    'history.action.create',
    'history.action.archive',
    'history.action.unarchive',
    'history.action.delete',
    'history.action.restore'
] as const

/** 新增键上限（R-7：≤13；超了必须报 PM） */
const MAX_NEW_KEYS = 13

/** 内部词黑名单（C 端红线） */
const INTERNAL_TERMS = [
    'fieldBase',
    'revision',
    'plain:',
    'OCC',
    'local-edit',
    'push-merge',
    'conflict-retry',
    'syncedServerUpdatedAt',
    'derivedUpdates',
    'archivedAt'
]

const zh = zhCN as unknown as Record<string, string>
const en = enUS as unknown as Record<string, string>

const keysWithPrefix = (messages: Record<string, string>, prefix: string): string[] =>
    Object.keys(messages).filter((key) => key.startsWith(prefix))

describe('T697 / R-7 变更历史面板文案键：齐备 + 双语言 + ≤13', () => {
    it('13 个框架键在 zh / en 全部齐备且非空', () => {
        for (const key of PANEL_KEYS) {
            expect(zh[key], `zh-CN 缺少 ${key}`).toBeTruthy()
            expect(en[key], `en-US 缺少 ${key}`).toBeTruthy()
        }
    })

    it('新增键 ≤13（R-7 上限；超了报 PM，⛔ 不得静默超）', () => {
        const zhKeys = keysWithPrefix(zh, 'history.')
        const enKeys = keysWithPrefix(en, 'history.')
        expect(zhKeys.length, '「变更历史」面板新增键不得超过 13 个').toBeLessThanOrEqual(
            MAX_NEW_KEYS
        )
        // 双语言键集合一致（en 不得缺键/多键）
        expect(enKeys.sort()).toEqual(zhKeys.sort())
        expect(zhKeys.length).toBeGreaterThan(0)
    })

    it('文案说人话：不得出现内部术语 / 技术键名 / 来源原始值', () => {
        for (const key of PANEL_KEYS) {
            const value = zh[key] ?? ''
            // 前置：键必须存在（否则「不含内部词」会在 undefined 上假绿）
            expect(value, `zh-CN 缺少 ${key}`).toBeTruthy()
            for (const term of INTERNAL_TERMS) {
                expect(value, `${key} 不得包含内部词 ${term}`).not.toContain(term)
            }
            // 不得把 i18n 键名本身当文案输出
            expect(value).not.toContain('history.')
        }
    })

    it('来源 4 值 / 动作 5 值的文案互不相同（文字冗余可区分）', () => {
        const groups = [
            [
                'history.source.local',
                'history.source.pull',
                'history.source.pushMerge',
                'history.source.conflictRetry'
            ],
            [
                'history.action.create',
                'history.action.archive',
                'history.action.unarchive',
                'history.action.delete',
                'history.action.restore'
            ]
        ]
        for (const group of groups) {
            const texts = group.map((key) => zh[key])
            expect(new Set(texts).size, `同组文案必须互不相同：${group.join(',')}`).toBe(
                texts.length
            )
        }
    })

    it('空态文案不复用冲突面板文案（语义不同：暂无变更记录 ≠ 暂无冲突记录）', () => {
        expect(zh['history.empty'], 'zh-CN 缺少 history.empty').toBeTruthy()
        expect(zh['sync.conflict.empty'], 'zh-CN 缺少 sync.conflict.empty').toBeTruthy()
        expect(zh['history.empty']).not.toBe(zh['sync.conflict.empty'])
    })
})