import { describe, expect, it } from 'vite-plus/test'
import zhCN from '../zh-CN'
import enUS from '../en-US'

/**
 * T531 · 提醒设置 / 弹窗新增文案键齐备（AC12 设计一致性 · 红基线）
 *
 * 口径（PRD §七 AC12 · §六 可访问性 · AGENTS.md「C 端说人话」）：
 * - 新增文案 **zh / en 双键齐备**（`types.ts` 的 `LocaleMessages` 同步补键，由 `vp check` 保证）；
 * - 文案**不得**裸露内部键名 / 技术术语（`quietHours` / `remindAt` / `projectId` / `silent` /
 *   `stale` 等），免打扰要说清「时段内不弹，结束后补一次」的**用户后果**；
 * - 设置区三项 + 权限三态 + 弹窗「完成 / 清单回退 / 原定时间」共 15 键。
 *
 * @see docs/prds/2026-10-24-reminder-settings.md §七 AC12
 */

const REQUIRED_KEYS = [
    'settings.reminder.title',
    'settings.reminder.notify',
    'settings.reminder.sound',
    'settings.reminder.quietHours',
    'settings.reminder.quietHoursStart',
    'settings.reminder.quietHoursEnd',
    'settings.reminder.quietNow',
    'settings.reminder.permission.granted',
    'settings.reminder.permission.denied',
    'settings.reminder.permission.unsupported',
    'settings.reminder.permission.hint',
    'settings.reminder.soundUnavailable',
    'dialog.taskReminder.complete',
    'dialog.taskReminder.projectFallback',
    'dialog.taskReminder.original'
] as const

const INTERNAL_TERMS = ['quietHours', 'remindAt', 'projectId', 'silent', 'unsupported']

describe('T531 · AC12 提醒相关文案键', () => {
    it('AC12 zh-CN 键齐备且非空', () => {
        for (const key of REQUIRED_KEYS) {
            expect(zhCN[key], `zh-CN 缺键或空值: ${key}`).toBeTruthy()
            expect(String(zhCN[key]).trim()).not.toBe('')
        }
    })

    it('AC12 en-US 键齐备且非空', () => {
        for (const key of REQUIRED_KEYS) {
            expect(enUS[key], `en-US 缺键或空值: ${key}`).toBeTruthy()
            expect(String(enUS[key]).trim()).not.toBe('')
        }
    })

    it('AC12 不裸露内部键名（C 端说人话）', () => {
        for (const key of REQUIRED_KEYS) {
            for (const term of INTERNAL_TERMS) {
                expect(String(zhCN[key])).not.toContain(term)
                expect(String(enUS[key])).not.toContain(term)
            }
        }
    })

    it('AC12 权限三态文案互不相同（三态可辨，不只靠颜色）', () => {
        const states = [
            zhCN['settings.reminder.permission.granted'],
            zhCN['settings.reminder.permission.denied'],
            zhCN['settings.reminder.permission.unsupported']
        ]
        expect(new Set(states).size).toBe(3)
    })
})