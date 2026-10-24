import { describe, expect, it } from 'vite-plus/test'
import { REMINDER_NOTICE_ACK_KEY } from '@nao-todo/shared/constants/storage-keys'
import { DEVICE_LEVEL_STORAGE_KEYS, USER_SCOPED_STORAGE_KEYS } from '../local-storage-policy'

/**
 * T531 · 提醒相关存储作用域（AC9 一次性 = 设备级 / AC11 设置 = 身份级 · 红基线）
 *
 * 契约（架构报告 §2.1 / §6.2 · PRD §六「隐私」）：
 * - `REMINDER_SETTINGS` 必须进 **`USER_SCOPED_STORAGE_KEYS`（身份级，登出清）**：
 *   设置随账号同步，切号不得串（设备级白名单会把 A 的设置带进 B 的账号）；
 * - `REMINDER_NOTICE_ACK` 必须进 **`DEVICE_LEVEL_STORAGE_KEYS`（设备级，登出保留）**：
 *   通知权限是「本浏览器 / 本设备」属性 ⇒ 登出后清掉会**重复打扰**（AC9「只出现一次」被破）。
 *
 * 键常量单一真源：`@nao-todo/shared/constants/storage-keys`（设备级常量集中于此，
 * 与 `PLAINTEXT_NOTICE_ACK_KEY` 同范式）；提醒设置键单一真源 = `shared/reminder`。
 *
 * @see docs/prds/2026-10-24-reminder-settings.md §六 隐私 · §七 AC9/AC11
 */

describe('T531 · 提醒存储作用域', () => {
    it('AC11 提醒设置 = 身份级（登出清、切号不串）', () => {
        expect(USER_SCOPED_STORAGE_KEYS).toContain('REMINDER_SETTINGS')
        expect(DEVICE_LEVEL_STORAGE_KEYS).not.toContain('REMINDER_SETTINGS')
    })

    it('AC9 一次性提示 ack = 设备级（登出保留，不重复打扰）', () => {
        expect(DEVICE_LEVEL_STORAGE_KEYS).toContain(REMINDER_NOTICE_ACK_KEY)
        expect(USER_SCOPED_STORAGE_KEYS).not.toContain(REMINDER_NOTICE_ACK_KEY)
    })

    it('AC9 ack 键名与常量一致（防手写字面量漂移）', () => {
        expect(REMINDER_NOTICE_ACK_KEY).toBe('REMINDER_NOTICE_ACK')
    })

    it('AC11 两类白名单互斥（同一键不得同时「保留」与「必清」）', () => {
        const overlap = DEVICE_LEVEL_STORAGE_KEYS.filter((key) =>
            USER_SCOPED_STORAGE_KEYS.includes(key)
        )
        expect(overlap).toEqual([])
    })
})