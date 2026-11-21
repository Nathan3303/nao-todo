import { describe, expect, it } from 'vite-plus/test'
import zhCN from '../zh-CN'
import enUS from '../en-US'

/**
 * T737 · 「关于与更新」文案键齐备 + C 端说人话（AC13）
 *
 * @description 桌面端自我更新块需要八态文案 + 动作 + 失败原因 + 平台降级 + 数据护栏，
 *              zh / en **双键齐备**且**不得裸露内部术语**（`updater` / `sha512` / `autoUpdater` /
 *              `latest.yml` / `release` 等），失败与护栏文案口径见设计稿 §5 / §7（⛔ 不写「失败」，措辞软提示）。
 *              八态文字**互不相同**（颜色 + 符号 + 文字三重冗余，文字是三冗余之一）。
 * @see docs/designs/358-desktop-self-update-copy.md（键值单一事实来源）
 * @see docs/prds/2026-11-20-desktop-self-update.md（AC13）
 */

const REQUIRED_KEYS = [
    'settings.update.title',
    'settings.update.currentVersion',
    'settings.update.lastChecked',
    'settings.update.check',
    'settings.update.checking',
    'settings.update.checkBlockedByReady',
    'settings.update.idle',
    'settings.update.idleHint',
    'settings.update.available',
    'settings.update.availableHint',
    'settings.update.availableHintNoSize',
    'settings.update.updateNow',
    'settings.update.downloading',
    'settings.update.downloadingSize',
    'settings.update.downloadingPercent',
    'settings.update.ready',
    'settings.update.readyHint',
    'settings.update.restartNow',
    'settings.update.later',
    'settings.update.upToDate',
    'settings.update.justUpdated',
    'settings.update.justUpdatedHint',
    'settings.update.openDownloadPage',
    'settings.update.failedCheck',
    'settings.update.failedDownload',
    'settings.update.failedVerify',
    'settings.update.reason.offline',
    'settings.update.reason.timeout',
    'settings.update.reason.server',
    'settings.update.reason.disk',
    'settings.update.reason.unknown',
    'settings.update.manual.mac',
    'settings.update.manual.deb',
    'settings.update.guard.title',
    'settings.update.guard.body',
    'settings.update.guard.syncFirst',
    'settings.update.guard.updateAnyway',
    'settings.update.settingsWithUpdate',
    'settings.update.a11y.progress',
    'settings.update.a11y.progressUnknown'
] as const

/** 状态文字（除 `checking` 由 `LoadingError` 承载外，其余都必须有独立文字） */
const STATE_TEXT_KEYS = [
    'settings.update.idle',
    'settings.update.available',
    'settings.update.downloading',
    'settings.update.ready',
    'settings.update.upToDate',
    'settings.update.justUpdated',
    'settings.update.failedCheck'
] as const

/** 面向用户的文案里不得出现的内部术语（小写比较） */
const INTERNAL_TERMS = [
    'updater',
    'autoupdater',
    'electron',
    'sha512',
    'latest.yml',
    'appimage',
    'app-update',
    'ipc',
    'preload',
    'failedcount',
    'syncqueue',
    't737'
].map((term) => term.toLowerCase())

type LooseCopy = Record<string, string | undefined>

const ZH = zhCN as unknown as LooseCopy
const EN = enUS as unknown as LooseCopy

describe('T737 · AC13 关于与更新文案键', () => {
    it('zh-CN 键齐备且非空', () => {
        const missing = REQUIRED_KEYS.filter((key) => {
            const value = ZH[key]
            return typeof value !== 'string' || value.trim() === ''
        })
        expect(missing).toEqual([])
    })

    it('en-US 键齐备且非空', () => {
        const missing = REQUIRED_KEYS.filter((key) => {
            const value = EN[key]
            return typeof value !== 'string' || value.trim() === ''
        })
        expect(missing).toEqual([])
    })

    it('插值占位符双语气一致（{version} / {count} / {percent} / {size} / {time}）', () => {
        const placeholders = (copy: string): string[] => (copy.match(/\{[a-zA-Z]+\}/g) ?? []).sort()
        const mismatched = REQUIRED_KEYS.filter((key) => {
            const zh = ZH[key]
            const en = EN[key]
            if (!zh || !en) return false
            return placeholders(zh).join(',') !== placeholders(en).join(',')
        })
        expect(mismatched).toEqual([])
    })

    it('八态文字互不相同（文字是三冗余之一）', () => {
        for (const messages of [ZH, EN]) {
            const texts = STATE_TEXT_KEYS.map((key) => messages[key])
            expect(new Set(texts).size).toBe(STATE_TEXT_KEYS.length)
        }
    })

    it('不裸露内部术语（说人话：不得出现 updater / sha512 / AppImage / 内部编号）', () => {
        const offenders: string[] = []
        for (const [locale, messages] of [
            ['zh-CN', ZH],
            ['en-US', EN]
        ] as const) {
            for (const key of REQUIRED_KEYS) {
                const copy = (messages[key] ?? '').toLowerCase()
                for (const term of INTERNAL_TERMS) {
                    if (copy.includes(term)) offenders.push(`${locale} ${key} ← ${term}`)
                }
            }
        }
        expect(offenders).toEqual([])
    })

    it('数据护栏文案为软提示（⛔ 不出现「失败 / failed」）', () => {
        expect(ZH['settings.update.guard.body'] ?? '').not.toContain('失败')
        expect(ZH['settings.update.guard.title'] ?? '').not.toContain('失败')
        expect((EN['settings.update.guard.body'] ?? '').toLowerCase()).not.toContain('fail')
        expect((EN['settings.update.guard.title'] ?? '').toLowerCase()).not.toContain('fail')
    })

    it('体积未知文案不编数字（不含 MB / GB）', () => {
        expect(ZH['settings.update.availableHintNoSize'] ?? '').not.toMatch(/[MG]B/)
        expect(EN['settings.update.availableHintNoSize'] ?? '').not.toMatch(/[MG]B/)
    })
})