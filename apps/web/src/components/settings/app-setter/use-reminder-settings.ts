/**
 * 设置区「提醒」小节状态源（T531 · AC1 / AC9 / C3）
 *
 * @description 三项（通知 / 声音 / 免打扰）并入既有「应用设置」区块（**不新增第 4 个 Tab**）。
 *              本地优先：每次改动**先写本地**（立即生效）⇒ 再 `markPreferenceDirty('userConfig')`
 *              （fire-and-forget，远端失败不影响本地值）。
 *
 *              权限三态不能只看 `'Notification' in window`（Android Chrome 有对象但页面构造抛错）⇒
 *              `granted` 但真实发送失败时由通知适配层回灌 `markUnsupported()` 降级。
 *              一次性说明按**设备级**键 `REMINDER_NOTICE_ACK` 记录「已提示过的状态」：
 *              同状态只出现一次，状态升级可再出现一次，重开浏览器不再出现。
 *              索权**只在用户手势**（点击设置区控件）时发起。
 * @see docs/prds/2026-10-24-reminder-settings.md（§三 范围 1/5 · §五 R5–R8 · §七 AC1/AC9）
 */

import { markPreferenceDirty } from '@nao-todo/infrastructure/src/persistence-sync/preference-sync'
import { REMINDER_NOTICE_ACK_KEY } from '@nao-todo/shared/constants/storage-keys'
import type { LocaleKey } from '@nao-todo/shared/locales'
import {
    isWithinQuietHours,
    readReminderSettings,
    writeReminderSettings,
    type QuietHoursRange,
    type ReminderSettings,
    type ReminderSettingsStorage
} from '@nao-todo/shared/reminder'
import { computed, ref } from 'vue'

/** 通知能力三态（`denied` 含浏览器未决 `default`：未授权即按未开启引导） */
export type NotificationState = 'granted' | 'denied' | 'unsupported'

/** 设置项键（顺序 = 展示顺序） */
export type ReminderSettingKey = 'notify' | 'sound' | 'quietHours'

/** 设置项（展示用） */
export type ReminderSettingItem = {
    key: ReminderSettingKey
    labelKey: LocaleKey
    /** 置灰（不影响提醒本身，只约束该开关的操作） */
    disabled: boolean
    /** 置灰原因说明（无 ⇒ null） */
    hintKey: LocaleKey | null
}

/** 可注入的最小窗口面（测试传桩；默认 `window`） */
export type ReminderSettingsWindow = {
    Notification?: {
        permission?: NotificationPermission
        requestPermission?(): unknown
    }
}

export type UseReminderSettingsOptions = {
    storage?: ReminderSettingsStorage | null
    now?: () => number
    win?: ReminderSettingsWindow
}

const SOUND_UNAVAILABLE_KEY: LocaleKey = 'settings.reminder.soundUnavailable'

/** 安全取存储（隐私模式下取属性本身可能抛错） */
const resolveStorage = (): ReminderSettingsStorage | null => {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage
    } catch {
        return null
    }
}

/** 读设备级 ack（已提示过的权限状态；不可用 / 脏值 ⇒ null） */
const readNoticeAck = (storage: ReminderSettingsStorage | null): string | null => {
    if (!storage) return null
    try {
        return storage.getItem(REMINDER_NOTICE_ACK_KEY)
    } catch {
        return null
    }
}

/** 写设备级 ack（静默失败） */
const writeNoticeAck = (storage: ReminderSettingsStorage | null, value: string): void => {
    if (!storage) return
    try {
        storage.setItem(REMINDER_NOTICE_ACK_KEY, value)
    } catch {
        /* 配额满 / 隐私模式：静默降级（下次进入会再提示一次） */
    }
}

/**
 * 提醒设置状态源（设置区「提醒」小节）
 * @param options 可注入存储 / 时钟 / 窗口（默认注入真实环境）
 */
export const useReminderSettings = (options: UseReminderSettingsOptions = {}) => {
    const storage = options.storage === undefined ? resolveStorage() : options.storage
    const now = options.now ?? (() => Date.now())
    const win = options.win ?? (typeof window === 'undefined' ? {} : window)

    const settings = ref<ReminderSettings>(readReminderSettings(storage))

    /** 真实发送失败降级（`granted` 但页面通知被禁用的平台） */
    const forcedUnsupported = ref(false)

    const notificationApi = win.Notification
    const supported = typeof notificationApi?.permission === 'string'
    const permission = ref<NotificationPermission | null>(
        supported ? notificationApi.permission! : null
    )

    const status = computed<NotificationState>(() => {
        if (!supported || forcedUnsupported.value) return 'unsupported'
        return permission.value === 'granted' ? 'granted' : 'denied'
    })

    const statusKey = computed<LocaleKey>(
        () => `settings.reminder.permission.${status.value}` as LocaleKey
    )

    /** 一次性说明（设备级：同状态只提示一次） */
    const noticeAck = ref<string | null>(readNoticeAck(storage))
    const noticeVisible = computed(
        () => status.value !== 'granted' && noticeAck.value !== status.value
    )

    const quietNow = computed(() => isWithinQuietHours(now(), settings.value.quietHours))

    /** 声音开关只在系统通知可用时有意义（避免「开了声音却没通知」的假开关） */
    const soundAvailable = computed(() => status.value === 'granted')
    const soundHintKey = computed<LocaleKey | null>(() =>
        soundAvailable.value ? null : SOUND_UNAVAILABLE_KEY
    )

    /** 是否可发起索权（仅浏览器未决状态；`denied` 再问也不会弹） */
    const canRequestPermission = computed(
        () => supported && !forcedUnsupported.value && permission.value === 'default'
    )

    const items = computed<readonly ReminderSettingItem[]>(() => [
        {
            key: 'notify',
            labelKey: 'settings.reminder.notify',
            disabled: status.value === 'unsupported',
            hintKey: null
        },
        {
            key: 'sound',
            labelKey: 'settings.reminder.sound',
            disabled: !soundAvailable.value,
            hintKey: soundHintKey.value
        },
        {
            key: 'quietHours',
            labelKey: 'settings.reminder.quietHours',
            disabled: false,
            hintKey: null
        }
    ])

    /** 先本地（立即生效）→ 再入偏好队列（fire-and-forget） */
    const commit = (next: ReminderSettings): void => {
        settings.value = next
        writeReminderSettings(storage, next)
        void markPreferenceDirty('userConfig')
    }

    const setNotify = (value: boolean): void => commit({ ...settings.value, notify: value })
    const setSound = (value: boolean): void => commit({ ...settings.value, sound: value })
    const setQuietHours = (range: QuietHoursRange | null): void =>
        commit({ ...settings.value, quietHours: range })

    /** 索权（仅用户手势调用；`denied` / `unsupported` 不再索权） */
    const requestPermission = async (): Promise<void> => {
        if (!supported || forcedUnsupported.value) return
        if (permission.value !== 'default') return
        try {
            const result = await notificationApi?.requestPermission?.()
            permission.value =
                typeof result === 'string' ? (result as NotificationPermission) : permission.value
        } catch {
            /* 索权失败：保持当前状态，应用内提醒不受影响 */
        }
    }

    /** 真实发送失败 ⇒ 降级为 `unsupported`（Android Chrome 页面通知） */
    const markUnsupported = (): void => {
        forcedUnsupported.value = true
    }

    const ackNotice = (): void => {
        noticeAck.value = status.value
        writeNoticeAck(storage, status.value)
    }

    return {
        settings,
        items,
        status,
        statusKey,
        noticeVisible,
        quietNow,
        soundAvailable,
        soundHintKey,
        canRequestPermission,
        setNotify,
        setSound,
        setQuietHours,
        requestPermission,
        markUnsupported,
        ackNotice
    }
}