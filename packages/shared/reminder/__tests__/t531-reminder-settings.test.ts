import { describe, expect, it } from 'vite-plus/test'
import {
    DEFAULT_REMINDER_SETTINGS,
    normalizeReminderSettings,
    readReminderSettings,
    REMINDER_SETTINGS_STORAGE_KEY,
    writeReminderSettings
} from '@nao-todo/shared/reminder'
import type { ReminderSettings } from '@nao-todo/shared/reminder'
import { FakeStorage } from './reminder-harness'

/**
 * T531 · 提醒设置模型（AC1 默认值 / AC11 旧数据缺字段 · 红基线）
 *
 * 契约（RD 按此实现，`packages/shared/reminder/reminder-settings.ts` + barrel 导出）：
 *
 * ```ts
 * export type ReminderSettings = {
 *     notify: boolean                      // 系统通知开关（不控制应用内弹窗）
 *     sound: boolean                       // 系统通知声音（映射 Notification `silent: !sound`）
 *     quietHours: QuietHoursRange | null   // 单段 [start, end)，null = 关闭
 * }
 * export const REMINDER_SETTINGS_STORAGE_KEY = 'REMINDER_SETTINGS'   // 身份级单键（原子 JSON）
 * export const DEFAULT_REMINDER_SETTINGS: ReminderSettings
 *     // = { notify: true, sound: true, quietHours: null } ⇒ 与 v1.12.15 行为一致
 * export const normalizeReminderSettings: (raw: unknown) => ReminderSettings  // 逐字段 fail-open
 * export const readReminderSettings: (storage: StorageLike) => ReminderSettings // 永不抛
 * export const writeReminderSettings: (
 *     storage: StorageLike,
 *     s: ReminderSettings | null   // null = **显式清空**（写入 JSON null 标记，供 C4② 回传）
 * ) => void // 永不抛
 * ```
 *
 * 口径（PRD §五 R5–R8 / §六 NFR / 架构报告 §2.2）：
 * - 默认值 = 通知开 / 声音开 / 免打扰关 ⇒ 默认行为与 `v1.12.15` 完全一致；
 * - 缺失 / 类型不符 / 非法 ⇒ **逐字段**取默认（`quietHours` 非法只关免打扰，不影响两个开关）；
 * - 存储不可用（隐私模式 / 配额满）⇒ 读默认、写静默失败，**不抛错、不阻断提醒**。
 *
 * @see docs/prds/2026-10-24-reminder-settings.md §五 R5/R6/R8 · §七 AC1/AC11
 */

describe('T531 · AC1 默认值（与 v1.12.15 行为一致）', () => {
    it('AC1 默认 = 通知开 / 声音开 / 免打扰关', () => {
        expect(DEFAULT_REMINDER_SETTINGS).toEqual({
            notify: true,
            sound: true,
            quietHours: null
        })
    })

    it('AC1 存储为空 ⇒ 读默认', () => {
        expect(readReminderSettings(new FakeStorage())).toEqual(DEFAULT_REMINDER_SETTINGS)
    })

    it('AC1 存储读抛错（隐私模式）⇒ 读默认且不抛', () => {
        const storage = new FakeStorage()
        storage.failAll = true

        expect(() => readReminderSettings(storage)).not.toThrow()
        expect(readReminderSettings(storage)).toEqual(DEFAULT_REMINDER_SETTINGS)
    })
})

describe('T531 · AC11 normalizeReminderSettings（旧数据缺字段 / 脏数据）', () => {
    it('AC11 全缺失 ⇒ 默认（旧快照无 reminder 字段）', () => {
        for (const raw of [undefined, null, {}, 0, '', []]) {
            expect(normalizeReminderSettings(raw)).toEqual(DEFAULT_REMINDER_SETTINGS)
        }
    })

    it('AC11 只给部分字段 ⇒ 缺的取默认、给的保留', () => {
        expect(normalizeReminderSettings({ sound: false })).toEqual({
            notify: true,
            sound: false,
            quietHours: null
        })
        expect(normalizeReminderSettings({ notify: false })).toEqual({
            notify: false,
            sound: true,
            quietHours: null
        })
    })

    it('AC11 类型不符的开关 ⇒ 该字段取默认（不整体丢弃）', () => {
        expect(normalizeReminderSettings({ notify: 'false', sound: 0 })).toEqual(
            DEFAULT_REMINDER_SETTINGS
        )
    })

    it('AC11 免打扰非法 ⇒ 只关免打扰，两个开关照常保留', () => {
        const settings = normalizeReminderSettings({
            notify: false,
            sound: false,
            quietHours: { start: '25:00', end: '08:00' }
        })

        expect(settings).toEqual({ notify: false, sound: false, quietHours: null })
    })

    it('AC11 合法免打扰 ⇒ 原样保留（含跨天）', () => {
        expect(
            normalizeReminderSettings({
                notify: true,
                sound: true,
                quietHours: { start: '22:00', end: '08:00' }
            }).quietHours
        ).toEqual({ start: '22:00', end: '08:00' })
    })

    it('AC11 任一脏输入 ⇒ 不抛错', () => {
        const dirty: unknown[] = [new Map(), Symbol('x'), () => {}, { quietHours: [] }]
        for (const raw of dirty) {
            expect(() => normalizeReminderSettings(raw)).not.toThrow()
        }
    })
})

describe('T531 · 读写往返（身份级单键 / 原子 JSON）', () => {
    it('单键 `REMINDER_SETTINGS` 存三项（拆键会产生半更新）', () => {
        const storage = new FakeStorage()
        writeReminderSettings(storage, {
            notify: false,
            sound: true,
            quietHours: { start: '22:00', end: '08:00' }
        })

        expect(REMINDER_SETTINGS_STORAGE_KEY).toBe('REMINDER_SETTINGS')
        const raw = storage.getItem(REMINDER_SETTINGS_STORAGE_KEY)
        expect(raw).not.toBeNull()
        expect(JSON.parse(raw as string)).toEqual({
            notify: false,
            sound: true,
            quietHours: { start: '22:00', end: '08:00' }
        })
        expect(storage.size).toBe(1) // 不额外拆键
    })

    it('写后读等价（AC1 重开保留）', () => {
        const storage = new FakeStorage()
        const settings: ReminderSettings = {
            notify: false,
            sound: false,
            quietHours: { start: '23:30', end: '06:15' }
        }
        writeReminderSettings(storage, settings)

        expect(readReminderSettings(storage)).toEqual(settings)
    })

    it('C4② 显式清空 ⇒ 写 JSON null 标记（与「从未设置」可区分 ⇒ 清空能回传）', () => {
        const storage = new FakeStorage()
        writeReminderSettings(storage, { notify: false, sound: false, quietHours: null })

        writeReminderSettings(storage, null)

        expect(storage.getItem(REMINDER_SETTINGS_STORAGE_KEY)).toBe('null')
        expect(readReminderSettings(storage)).toEqual(DEFAULT_REMINDER_SETTINGS)
    })

    it('写抛错（配额满）⇒ 静默失败、不抛', () => {
        const storage = new FakeStorage()
        storage.failAll = true

        expect(() => writeReminderSettings(storage, DEFAULT_REMINDER_SETTINGS)).not.toThrow()
    })

    it('坏 JSON（手工改坏）⇒ 读默认，不抛', () => {
        const storage = new FakeStorage()
        storage.setItem(REMINDER_SETTINGS_STORAGE_KEY, '{not-json')

        expect(() => readReminderSettings(storage)).not.toThrow()
        expect(readReminderSettings(storage)).toEqual(DEFAULT_REMINDER_SETTINGS)
    })
})