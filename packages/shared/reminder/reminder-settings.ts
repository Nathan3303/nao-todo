/**
 * 提醒设置模型（T531 · AC1 / AC11）
 *
 * @description 本地**身份级单键**原子 JSON（`REMINDER_SETTINGS`）：
 *              免打扰是 start/end 成对写入，拆键会出现半更新（T530 §2.2）。
 *              默认值 = 通知开 / 声音开 / 免打扰关 ⇒ 与 `v1.12.15` 行为完全一致。
 *              读写**永不抛**（隐私模式 / 配额满 ⇒ 读默认、写静默失败），不阻断提醒。
 * @see docs/prds/2026-10-24-reminder-settings.md（§五 R5–R8 / §七 AC1 / AC11）
 */
import { normalizeQuietHours, type QuietHoursRange } from './quiet-hours'

/** 提醒设置三项 */
export type ReminderSettings = {
    /** 系统通知开关（**不控制**应用内弹窗） */
    notify: boolean
    /** 系统通知声音（映射 `silent: !sound`） */
    sound: boolean
    /** 单段免打扰时段；`null` = 关闭 */
    quietHours: QuietHoursRange | null
}

/** 本地存储键（身份级：登出清、切号不串） */
export const REMINDER_SETTINGS_STORAGE_KEY = 'REMINDER_SETTINGS'

/** 默认设置（= `v1.12.15` 行为：有通知、有声音、不静默） */
export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = Object.freeze({
    notify: true,
    sound: true,
    quietHours: null
})

/** 只依赖用到的方法，便于注入 `Storage` 形状的假存储 */
export type ReminderSettingsStorage = {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
}

/**
 * 归一化设置（逐字段 fail-open）
 * @param raw 任意来源（本地 JSON / 远端快照）
 * @description 缺失 / 类型不符 ⇒ 该字段取默认；免打扰非法只关免打扰，不影响两个开关。
 */
export const normalizeReminderSettings = (raw: unknown): ReminderSettings => {
    const source =
        raw && typeof raw === 'object' && !Array.isArray(raw)
            ? (raw as { notify?: unknown; sound?: unknown; quietHours?: unknown })
            : {}
    return {
        notify:
            typeof source.notify === 'boolean' ? source.notify : DEFAULT_REMINDER_SETTINGS.notify,
        sound: typeof source.sound === 'boolean' ? source.sound : DEFAULT_REMINDER_SETTINGS.sound,
        quietHours: normalizeQuietHours(source.quietHours)
    }
}

/**
 * 读取本地提醒设置（永不抛）
 * @description 键不存在 / 坏 JSON / 显式清空标记 `null` / 存储不可用 ⇒ 默认值。
 */
export const readReminderSettings = (
    storage?: ReminderSettingsStorage | null
): ReminderSettings => {
    if (!storage) return normalizeReminderSettings(undefined)
    try {
        const raw = storage.getItem(REMINDER_SETTINGS_STORAGE_KEY)
        if (raw === null) return normalizeReminderSettings(undefined)
        return normalizeReminderSettings(JSON.parse(raw) as unknown)
    } catch {
        return normalizeReminderSettings(undefined)
    }
}

/**
 * 写入本地提醒设置（永不抛）
 * @param storage 存储面（不可用 ⇒ 静默失败）
 * @param settings 设置；`null` = **显式清空标记**（写 JSON `null`，供 AC11② 回传「已清空」）
 */
export const writeReminderSettings = (
    storage: ReminderSettingsStorage | null | undefined,
    settings: ReminderSettings | null
): void => {
    if (!storage) return
    try {
        storage.setItem(
            REMINDER_SETTINGS_STORAGE_KEY,
            JSON.stringify(settings === null ? null : normalizeReminderSettings(settings))
        )
    } catch {
        /* 配额满 / 隐私模式：静默降级（不阻断设置操作） */
    }
}