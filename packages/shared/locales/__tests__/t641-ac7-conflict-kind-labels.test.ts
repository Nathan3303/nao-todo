import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import zhCN from '../zh-CN'
import enUS from '../en-US'

/**
 * T641 / `AC7`（文案与三态）用例先行（红基线）—— 本批新增 kind 的用户可读 label + 内部术语 0 命中
 *
 * 契约真源：PRD AC7 / §五 `R-C`（说人话）· `T640` Q2「必须新开 kind `pull-local-wins`」+
 *          §2 风险 9「新 kind 漏本地化 ⇒ 内部词回归」· `AGENTS.md` C 端原则。
 *
 * 覆盖（现状**红**）：
 * ① 新 kind `pull-local-wins` 的 zh / en 用户可读 label 齐备（当前缺失 ⇒ 现状红）；
 * ② 全部 kind（含新 kind）都有 label，且 zh 文案**互不相同**（三态冗余的「文字」维）；
 * ③ `stale|noop|OCC|base|derivedUpdates` 在**用户可见串**（`sync.conflict.*` 文案值）中 **0 命中**
 *    —— 现绿护栏（防本批新增文案把内部术语带回来）；
 * ④ 冲突列表组件接入新 kind 的 label 映射（源码级断言，防「有键但没接」）。
 *
 * 口径：术语扫描用**词边界**匹配（`Occurred at` 中的 `occ` 不算命中）；只扫 `sync.conflict.*`
 *      值（用户可见串），不扫源码标识符。
 */

const KINDS = [
    'remote-wins',
    'push-noop',
    'stale',
    'conflict',
    'skipped',
    'pull-local-wins'
] as const

const INTERNAL_TERMS = ['stale', 'noop', 'OCC', 'base', 'derivedUpdates'] as const

const labelKeyOf = (kind: string): string => `sync.conflict.kind.${kind}`

const messagesOf = (messages: unknown): Record<string, string> => messages as Record<string, string>

describe('T641 / AC7 冲突 kind 文案（含新 kind）', () => {
    it('新 kind pull-local-wins 有用户可读 label（zh / en 双键非空）—— 现状红', () => {
        const key = labelKeyOf('pull-local-wins')
        expect(messagesOf(zhCN)[key]?.trim(), `zh-CN 缺键: ${key}`).toBeTruthy()
        expect(messagesOf(enUS)[key]?.trim(), `en-US 缺键: ${key}`).toBeTruthy()
    })

    it('所有 kind 均有 label，且 zh 文案互不相同（文字维可辨）', () => {
        const keys = KINDS.map(labelKeyOf)
        for (const key of keys) {
            expect(messagesOf(zhCN)[key]?.trim(), `zh-CN 缺键: ${key}`).toBeTruthy()
            expect(messagesOf(enUS)[key]?.trim(), `en-US 缺键: ${key}`).toBeTruthy()
        }
        const zhLabels = keys.map((key) => messagesOf(zhCN)[key])
        expect(new Set(zhLabels).size).toBe(keys.length)
    })

    it('用户可见串中 stale|noop|OCC|base|derivedUpdates 0 命中 —— 现绿护栏（词边界）', () => {
        const pattern = new RegExp(`\\b(${INTERNAL_TERMS.join('|')})\\b`, 'i')
        for (const [locale, messages] of [
            ['zh-CN', messagesOf(zhCN)],
            ['en-US', messagesOf(enUS)]
        ] as const) {
            for (const [key, value] of Object.entries(messages)) {
                if (!key.startsWith('sync.conflict')) continue
                expect(
                    pattern.test(value),
                    `${locale} 用户可见串裸露内部术语: ${key} = ${value}`
                ).toBe(false)
            }
        }
    })

    it('冲突列表组件接入新 kind 的 label 映射（源码级）', () => {
        const source = readFileSync(
            join(process.cwd(), 'apps/web/src/components/sync/conflict-list.vue'),
            'utf8'
        )
        // 形如 `'pull-local-wins': 'sync.conflict.kind.pull-local-wins'`
        expect(source).toMatch(/['"]pull-local-wins['"]\s*:/)
    })
})