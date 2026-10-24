// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
    DEVICE_LEVEL_STORAGE_KEYS,
    USER_SCOPED_STORAGE_KEYS
} from '@nao-todo/infrastructure/src/persistence-local/deletion/local-storage-policy'
import { REMINDER_NOTIFY_UNSUPPORTED_KEY } from '@nao-todo/shared/constants/storage-keys'
import { t } from '@nao-todo/shared/locales'
import {
    DEFAULT_REMINDER_SETTINGS,
    markNotifyUnsupported,
    type TaskReminderEvent
} from '@nao-todo/shared/reminder'
import { useReminderSettings } from '../../../components/settings/app-setter/use-reminder-settings'
import { createReminderNotify } from '../reminder-notify'

/**
 * T532 · C3 装配接线：`granted` 但「未送达」⇒ 设备级降级标记回灌设置区（AC9）
 *
 * @description 验收点（PM 2026-10-24 授权新增）：
 *              ① 派发层 `send` 返回 **false** 且权限为 `granted` ⇒ 写**设备级**标记
 *                `REMINDER_NOTIFY_UNSUPPORTED`（与 `REMINDER_NOTICE_ACK` 同范式，登出不清）；
 *              ② 设置区读取该标记 ⇒ `status = 'unsupported'`（声音置灰 + 说明），**刷新仍在**
 *                （`useReminderSettings()` 新实例 = 重开浏览器）；
 *              ③ 权限非 `granted`（`default` / `denied`）或 `send` 返回 true ⇒ **不写**
 *                （这两类已有各自的引导口径，不得误标「不支持」）；
 *              ④ 幂等：连续未送达不重复写（已有标记即 return）。
 *
 * 用户可感缺口（修前）：Android Chrome 页面通知被禁用时，设置区显示「系统通知已开启」且
 * 声音可用，实际收不到通知。iPhone Safari / 桌面 Chrome 不受影响（分别为无 API / 能发出）。
 *
 * @see docs/prds/2026-10-24-reminder-settings.md（§七 AC9 · C3）
 */

const mocks = vi.hoisted(() => ({ markPreferenceDirty: vi.fn(async () => undefined) }))

vi.mock('@nao-todo/infrastructure/src/persistence-sync/preference-sync', () => ({
    markPreferenceDirty: mocks.markPreferenceDirty
}))
vi.mock('@nao-todo/infrastructure', () => ({
    markPreferenceDirty: mocks.markPreferenceDirty
}))

const EVENT: TaskReminderEvent = {
    taskId: 't1',
    taskName: '买菜',
    projectId: 'p1',
    remindAt: new Date(2026, 9, 24, 22, 10).toISOString()
}

const makeWin = (permission: NotificationPermission) => ({
    Notification: { permission, requestPermission: vi.fn(async () => permission) }
})

/** 触发一轮派发（注入权限来源 + 真实设备级标记写入） */
const dispatch = (options: { delivered: boolean; permission: NotificationPermission }) => {
    const notify = createReminderNotify({
        openDialog: () => undefined,
        send: () => options.delivered,
        readSettings: () => DEFAULT_REMINDER_SETTINGS,
        getNotificationPermission: () => options.permission,
        markNotifyUnsupported: () => markNotifyUnsupported(localStorage)
    })
    notify(EVENT)
}

const marker = (): string | null => localStorage.getItem(REMINDER_NOTIFY_UNSUPPORTED_KEY)

beforeEach(() => {
    localStorage.clear()
    mocks.markPreferenceDirty.mockClear()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('T532 · C3 未送达 ⇒ 设备级降级标记', () => {
    it('C3 send=false 且 permission=granted ⇒ 写设备级标记（值 1）', () => {
        dispatch({ delivered: false, permission: 'granted' })

        expect(marker()).toBe('1')
    })

    it('C3 send=true（发出成功）⇒ 不写标记', () => {
        dispatch({ delivered: true, permission: 'granted' })

        expect(marker()).toBeNull()
    })

    it('C3 权限非 granted（default / denied）⇒ 不写标记（已有各自引导，不得误标「不支持」）', () => {
        dispatch({ delivered: false, permission: 'default' })
        expect(marker()).toBeNull()

        dispatch({ delivered: false, permission: 'denied' })
        expect(marker()).toBeNull()
    })

    it('C3 未注入权限来源 ⇒ 读全局 `Notification.permission`（生产路径）', () => {
        const NotificationStub = class {
            static permission: NotificationPermission = 'granted'
        }
        vi.stubGlobal('Notification', NotificationStub)

        const notify = createReminderNotify({
            openDialog: () => undefined,
            send: () => false,
            readSettings: () => DEFAULT_REMINDER_SETTINGS,
            markNotifyUnsupported: () => markNotifyUnsupported(localStorage)
        })
        notify(EVENT)

        expect(marker()).toBe('1')
        vi.unstubAllGlobals()
    })

    it('C3 幂等：连续 3 次未送达 ⇒ 只写 1 次（不重复写存储）', () => {
        const written: string[] = []
        const setItem = vi.spyOn(Storage.prototype, 'setItem')

        dispatch({ delivered: false, permission: 'granted' })
        dispatch({ delivered: false, permission: 'granted' })
        dispatch({ delivered: false, permission: 'granted' })

        for (const call of setItem.mock.calls) {
            if (call[0] === REMINDER_NOTIFY_UNSUPPORTED_KEY) written.push(String(call[1]))
        }
        expect(written).toEqual(['1'])
        expect(marker()).toBe('1')
    })
})

describe('T532 · C3 标记回灌设置区（刷新仍在 / 声音置灰）', () => {
    it('C3 未标记时（granted）⇒ 已开启、声音可用', () => {
        const api = useReminderSettings({ win: makeWin('granted') })

        expect(api.status.value).toBe('granted')
        expect(api.soundAvailable.value).toBe(true)
        expect(api.soundHintKey.value).toBeNull()
    })

    it('C3 未送达后重开（新实例）⇒ status=unsupported + 声音置灰 + 说明（刷新仍在）', () => {
        // 修前缺口现场：设置区先显示「已开启」，随后真实发送失败
        const before = useReminderSettings({ win: makeWin('granted') })
        expect(before.status.value).toBe('granted')

        dispatch({ delivered: false, permission: 'granted' })

        // 重开浏览器 = 新实例（只读存储，不依赖上一实例内存态）
        const reopened = useReminderSettings({ win: makeWin('granted') })
        expect(reopened.status.value).toBe('unsupported')
        expect(reopened.statusKey.value).toBe('settings.reminder.permission.unsupported')
        expect(reopened.soundAvailable.value).toBe(false)
        expect(reopened.soundHintKey.value).toBe('settings.reminder.soundUnavailable')
        // 通知开关同步置灰（只说应用内仍会提醒，不隐藏提醒本身）
        expect(reopened.items.value[0]?.disabled).toBe(true)
        expect(reopened.items.value[1]?.disabled).toBe(true)
    })

    it('C3 设置区 markUnsupported() 也持久化（刷新后仍为 unsupported）', () => {
        const api = useReminderSettings({ win: makeWin('granted') })
        api.markUnsupported()

        expect(marker()).toBe('1')
        expect(useReminderSettings({ win: makeWin('granted') }).status.value).toBe('unsupported')
    })

    it('C3 标记为设备级：登出不清（DEVICE 白名单）、非身份级', () => {
        expect(DEVICE_LEVEL_STORAGE_KEYS).toContain(REMINDER_NOTIFY_UNSUPPORTED_KEY)
        expect(USER_SCOPED_STORAGE_KEYS).not.toContain(REMINDER_NOTIFY_UNSUPPORTED_KEY)
        expect(REMINDER_NOTIFY_UNSUPPORTED_KEY).toBe('REMINDER_NOTIFY_UNSUPPORTED')
        // 常量字面量单一真源（防手写漂移）
        expect(t('settings.reminder.permission.unsupported').trim()).not.toBe('')
    })
})