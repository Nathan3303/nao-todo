import { describe, expect, it } from 'vite-plus/test'
import zhCN from '../zh-CN'
import enUS from '../en-US'

/**
 * T544 · 「桌面常驻」文案键齐备 + C 端说人话（AC13 设计一致性 · 红基线）
 *
 * @description 设置「提醒 → 桌面常驻」子块（D1）需四态状态文案 + 开关 + 重试 + 退出入口；
 *              zh / en **双键齐备**且**不得裸露内部术语**（`tray` / `deviceId` / `electron` /
 *              `autostart` / `reclaim` / `token` 等），免密/会话类概念一律说用户能懂的话。
 *              状态**文字本身必须互不相同**（AC13 要求颜色 + 符号 + 文字三重冗余，文字是三冗余之一）。
 *
 * 期望实现落点：`packages/shared/locales/{zh-CN,en-US}.ts` + `types.ts` 的 `LocaleMessages` 同步补键。
 * 约定（新增键名，与既有 `settings.reminder.*` 命名一致；RD 可改名但需同步本文件）：
 * `settings.reminder.desktop.{title,autostart,retry,quit,hint}` +
 * `settings.reminder.desktop.status.{available,unconfirmed,needsApproval,unsupported}`
 *
 * 不覆盖（用户视觉验收）：三重冗余的实际呈现、窄屏 ≤445px 布局、托盘图标可辨识度。
 * @see docs/prds/2026-10-25-desktop-tray-autostart.md（AC13 / D1 / R3 降级不静默）
 * @see docs/reports/T543-arch-review.md（§四 托盘判定口径：available / unconfirmed / unsupported）
 */

const REQUIRED_KEYS = [
    'settings.reminder.desktop.title',
    'settings.reminder.desktop.autostart',
    'settings.reminder.desktop.status.available',
    'settings.reminder.desktop.status.unconfirmed',
    'settings.reminder.desktop.status.needsApproval',
    'settings.reminder.desktop.status.unsupported',
    'settings.reminder.desktop.retry',
    'settings.reminder.desktop.quit',
    'settings.reminder.desktop.hint'
] as const

/** 四态状态文案（AC13：已开启 / 可能不可见 / 需系统批准 / 不支持） */
const STATUS_KEYS = [
    'settings.reminder.desktop.status.available',
    'settings.reminder.desktop.status.unconfirmed',
    'settings.reminder.desktop.status.needsApproval',
    'settings.reminder.desktop.status.unsupported'
] as const

/** 面向用户的文案里不得出现的内部术语（小写比较） */
const INTERNAL_TERMS = [
    'tray',
    'deviceid',
    'electron',
    'autostart',
    'reclaim',
    'daemon',
    'jwt',
    'token',
    'localstorage',
    'userdata',
    'quietHours',
    'remindAt'
].map((term) => term.toLowerCase())

type LooseCopy = Record<string, string | undefined>

const ZH = zhCN as unknown as LooseCopy
const EN = enUS as unknown as LooseCopy

/** 取文案；缺键或空值 ⇒ 抛「缺文案」，让红基线失败原因指向缺实现（而不是空过） */
const requireCopy = (messages: LooseCopy, locale: string, key: string): string => {
    const value = messages[key]
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(
            `[缺文案] ${locale} 缺 ${key}（AC13 桌面常驻子块：请补 zh/en 与 LocaleMessages）`
        )
    }
    return value
}

describe('T544 · AC13 桌面常驻文案键', () => {
    it('zh-CN 键齐备且非空（子块标题 / 开关 / 四态 / 重试 / 退出 / 提示）', () => {
        for (const key of REQUIRED_KEYS) {
            const value = ZH[key]
            expect(
                typeof value === 'string' && value.trim() !== '',
                `zh-CN 缺键或空值: ${key}`
            ).toBe(true)
        }
    })

    it('en-US 键齐备且非空', () => {
        for (const key of REQUIRED_KEYS) {
            const value = EN[key]
            expect(
                typeof value === 'string' && value.trim() !== '',
                `en-US 缺键或空值: ${key}`
            ).toBe(true)
        }
    })

    it('不裸露内部术语（C 端说人话：tray / deviceId / electron / autostart / token …）', () => {
        for (const key of REQUIRED_KEYS) {
            for (const locale of [
                ['zh-CN', ZH],
                ['en-US', EN]
            ] as const) {
                const copy = requireCopy(locale[1], locale[0], key).toLowerCase()
                for (const term of INTERNAL_TERMS) {
                    expect(copy, `${locale[0]} 的 ${key} 出现内部术语「${term}」`).not.toContain(
                        term
                    )
                }
            }
        }
    })

    it('四态状态文案互不相同（文字是三冗余之一，不能四态同文）', () => {
        const zhStatuses = STATUS_KEYS.map((key) => requireCopy(ZH, 'zh-CN', key))
        const enStatuses = STATUS_KEYS.map((key) => requireCopy(EN, 'en-US', key))

        expect(new Set(zhStatuses).size).toBe(STATUS_KEYS.length)
        expect(new Set(enStatuses).size).toBe(STATUS_KEYS.length)
    })

    it('既有全部文案值不含内部术语（防把技术词带进任何界面）', () => {
        const offenders: string[] = []
        for (const [locale, messages] of [
            ['zh-CN', ZH],
            ['en-US', EN]
        ] as const) {
            for (const [key, value] of Object.entries(messages)) {
                if (typeof value !== 'string') continue
                const copy = value.toLowerCase()
                for (const term of INTERNAL_TERMS) {
                    if (copy.includes(term)) offenders.push(`${locale} ${key} ← ${term}`)
                }
            }
        }

        expect(offenders).toEqual([])
    })
})