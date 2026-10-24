// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { REMINDER_NOTICE_ACK_KEY } from '@nao-todo/shared/constants/storage-keys'
import { REMINDER_SETTINGS_STORAGE_KEY } from '@nao-todo/shared/reminder'
import { useReminderSettings } from '../use-reminder-settings'

/**
 * T531 · 设置区「提醒」三项（AC1 / AC9 三态与一次性 · 红基线）
 *
 * 契约（RD 按此实现，`apps/web/src/components/settings/app-setter/use-reminder-settings.ts`）：
 *
 * ```ts
 * export type NotificationState = 'granted' | 'denied' | 'unsupported'
 *
 * export const useReminderSettings = (options?: {
 *     storage?: Storage
 *     now?: () => number
 *     win?: { Notification?: { permission?: NotificationPermission; requestPermission?(): unknown } }
 * }) => {
 *     settings: Ref<ReminderSettings>                       // 三项（见 shared/reminder）
 *     items: ComputedRef<readonly ReminderSettingItem[]>     // 固定 3 项，顺序 notify/sound/quietHours
 *     status: Ref<NotificationState>                        // 三态（AC9）
 *     statusKey: ComputedRef<LocaleKey>                     // 设置区常驻状态文案
 *     noticeVisible: Ref<boolean>                           // 一次性说明（**设备级** ack）
 *     quietNow: ComputedRef<boolean>                        // 免打扰生效中（同 isWithinQuietHours 口径）
 *     soundAvailable: ComputedRef<boolean>                   // 声音开关是否可用（C3：仅 granted 为 true）
 *     soundHintKey: ComputedRef<LocaleKey | null>            // 不可用时的说明文案键（C3）
 *     setNotify(value: boolean): void
 *     setSound(value: boolean): void
 *     setQuietHours(range: QuietHoursRange | null): void
 *     requestPermission(): void                             // 仅用户手势调用；denied/unsupported 不索权
 *     markUnsupported(): void                               // 真实发送失败 ⇒ 降级 unsupported（架构 Q5）
 *     ackNotice(): void                                     // 记录「已提示过」（设备级）
 * }
 * ```
 *
 * 口径（PRD §三 范围 1/5 · §五 R5–R8 · §七 AC1/AC9 · 架构报告 §6）：
 * - **不新增第 4 个 Tab**：三项并入「应用设置」区块（本 composable 即该区块的状态源）；
 * - 默认 = 通知开 / 声音开 / 免打扰关（与 `v1.12.15` 一致）；
 * - 每次改动 ⇒ **先写本地**（立即生效）→ 再 `markPreferenceDirty('userConfig')`（fire-and-forget）；
 * - 权限三态判定不能只看 `'Notification' in window`（Android Chrome 有对象但构造抛错）⇒
 *   真实发送失败经 `markUnsupported()` 降级；
 * - 一次性说明按**设备级**键 `REMINDER_NOTICE_ACK` 记录「已提示过的状态」：
 *   同状态只出现一次，状态升级（denied → unsupported）可再出现一次；重开浏览器仍不再出现；
 * - 索权**只在用户手势**（点击开关）时发起（启动自动索权会被 Safari/Chrome 忽略）；
 * - **C3（T530 终签）**：`granted` 但构造仍失败（Android Chrome 页面通知）⇒ 与 `unsupported`
 *   同口径：仅应用内 + 一次性引导，且**声音开关置灰并给说明**（`soundAvailable=false` +
 *   `soundHintKey`）；置灰只影响操作，**不得**隐藏提醒本身。
 *
 * @see docs/prds/2026-10-24-reminder-settings.md §七 AC1/AC9
 */

const mocks = vi.hoisted(() => ({ markPreferenceDirty: vi.fn(async () => undefined) }))

vi.mock('@nao-todo/infrastructure/src/persistence-sync/preference-sync', () => ({
    markPreferenceDirty: mocks.markPreferenceDirty
}))
vi.mock('@nao-todo/infrastructure', () => ({
    markPreferenceDirty: mocks.markPreferenceDirty
}))

type Permission = NotificationPermission

const makeWin = (permission: Permission | null) => {
    if (permission === null) return {} // 无 Notification 能力（iPhone Safari 标签页）
    const requestPermission = vi.fn(async () => 'denied' as Permission)
    return { Notification: { permission, requestPermission } }
}

const localSettings = (): Record<string, unknown> | null => {
    const raw = localStorage.getItem(REMINDER_SETTINGS_STORAGE_KEY)
    return raw === null ? null : JSON.parse(raw)
}

/** 本地墙钟（DEF-81：禁 UTC 字面量） */
const NIGHT = new Date(2026, 9, 24, 23, 0).getTime()
const NOON = new Date(2026, 9, 24, 12, 0).getTime()

beforeEach(() => {
    localStorage.clear()
    mocks.markPreferenceDirty.mockClear()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('T531 · AC1 三项与默认值', () => {
    it('AC1 固定三项、顺序 notify → sound → quietHours（并入「应用设置」区块，不加 Tab）', () => {
        const api = useReminderSettings({ win: makeWin('granted'), now: () => NOON })

        expect(api.items.value.map((item) => item.key)).toEqual(['notify', 'sound', 'quietHours'])
        expect(api.items.value.map((item) => item.labelKey)).toEqual([
            'settings.reminder.notify',
            'settings.reminder.sound',
            'settings.reminder.quietHours'
        ])
    })

    it('AC1 默认 = 通知开 / 声音开 / 免打扰关', () => {
        const api = useReminderSettings({ win: makeWin('granted'), now: () => NOON })

        expect(api.settings.value).toEqual({ notify: true, sound: true, quietHours: null })
    })

    it('AC1 本地已有设置 ⇒ 读取生效（重开保留）', () => {
        localStorage.setItem(
            REMINDER_SETTINGS_STORAGE_KEY,
            JSON.stringify({
                notify: false,
                sound: false,
                quietHours: { start: '22:00', end: '08:00' }
            })
        )

        const api = useReminderSettings({ win: makeWin('granted'), now: () => NIGHT })

        expect(api.settings.value).toEqual({
            notify: false,
            sound: false,
            quietHours: { start: '22:00', end: '08:00' }
        })
    })

    it('AC11 旧数据缺字段 / 坏 JSON ⇒ 取默认，不抛', () => {
        localStorage.setItem(REMINDER_SETTINGS_STORAGE_KEY, '{broken')

        const api = useReminderSettings({ win: makeWin('granted'), now: () => NOON })

        expect(api.settings.value).toEqual({ notify: true, sound: true, quietHours: null })
    })
})

describe('T531 · AC1 改动立即生效并持久化', () => {
    it('AC1 setNotify ⇒ 写本地身份级单键 + 入偏好队列（markPreferenceDirty userConfig）', () => {
        const api = useReminderSettings({ win: makeWin('granted'), now: () => NOON })

        api.setNotify(false)

        expect(api.settings.value.notify).toBe(false)
        expect(localSettings()).toMatchObject({ notify: false, sound: true, quietHours: null })
        expect(mocks.markPreferenceDirty).toHaveBeenCalledWith('userConfig')
    })

    it('AC3 setSound ⇒ 持久化并推送（声音只影响系统通知）', () => {
        const api = useReminderSettings({ win: makeWin('granted'), now: () => NOON })

        api.setSound(false)

        expect(localSettings()).toMatchObject({ sound: false })
        expect(mocks.markPreferenceDirty).toHaveBeenCalledTimes(1)
    })

    it('AC6 setQuietHours ⇒ 持久化跨天时段；设 null ⇒ 关闭免打扰', () => {
        const api = useReminderSettings({ win: makeWin('granted'), now: () => NIGHT })

        api.setQuietHours({ start: '22:00', end: '08:00' })
        expect(localSettings()).toMatchObject({ quietHours: { start: '22:00', end: '08:00' } })

        api.setQuietHours(null)
        expect(localSettings()).toMatchObject({ quietHours: null })
        expect(mocks.markPreferenceDirty).toHaveBeenCalledTimes(2)
    })

    it('AC1 quietNow 与区间判定同口径（生效中 ⇒ true；段外 ⇒ false）', () => {
        const night = useReminderSettings({ win: makeWin('granted'), now: () => NIGHT })
        night.setQuietHours({ start: '22:00', end: '08:00' })
        expect(night.quietNow.value).toBe(true)

        const noon = useReminderSettings({ win: makeWin('granted'), now: () => NOON })
        expect(noon.quietNow.value).toBe(false)
    })

    it('E 存储不可用 ⇒ 改动仍作用于内存、不抛错（UI 不报错）', () => {
        const api = useReminderSettings({ win: makeWin('granted'), now: () => NOON })
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota exceeded')
        })

        expect(() => api.setNotify(false)).not.toThrow()
        expect(api.settings.value.notify).toBe(false)
    })
})

describe('T531 · AC9 权限三态 + 一次性说明（设备级）', () => {
    it('AC9 granted ⇒ status=granted，常驻状态文案取 granted 键', () => {
        const api = useReminderSettings({ win: makeWin('granted'), now: () => NOON })

        expect(api.status.value).toBe('granted')
        expect(api.statusKey.value).toBe('settings.reminder.permission.granted')
        expect(api.noticeVisible.value).toBe(false) // granted 不需要引导
    })

    it('AC9 denied ⇒ status=denied，首次出现一次性说明', () => {
        const api = useReminderSettings({ win: makeWin('denied'), now: () => NOON })

        expect(api.status.value).toBe('denied')
        expect(api.statusKey.value).toBe('settings.reminder.permission.denied')
        expect(api.noticeVisible.value).toBe(true)
    })

    it('AC9 无 Notification 能力 ⇒ status=unsupported（不比 denied 文案）', () => {
        const api = useReminderSettings({ win: makeWin(null), now: () => NOON })

        expect(api.status.value).toBe('unsupported')
        expect(api.statusKey.value).toBe('settings.reminder.permission.unsupported')
        expect(api.noticeVisible.value).toBe(true)
    })

    it('AC9 一次性：ackNotice 后不再出现，且重开（新实例）仍不出现（设备级持久）', () => {
        const first = useReminderSettings({ win: makeWin('denied'), now: () => NOON })
        expect(first.noticeVisible.value).toBe(true)
        first.ackNotice()
        expect(first.noticeVisible.value).toBe(false)

        // 设备级：ack 写入 REMINDER_NOTICE_ACK（不是身份级 REMINDER_SETTINGS）
        expect(localStorage.getItem(REMINDER_NOTICE_ACK_KEY)).not.toBeNull()

        const reopened = useReminderSettings({ win: makeWin('denied'), now: () => NOON })
        expect(reopened.noticeVisible.value).toBe(false)
    })

    it('AC9 状态升级（denied → unsupported）⇒ 可再出现一次（ack 记录的是「已提示过的状态」）', () => {
        const api = useReminderSettings({ win: makeWin('denied'), now: () => NOON })
        api.ackNotice()
        expect(api.noticeVisible.value).toBe(false)

        api.markUnsupported()
        expect(api.status.value).toBe('unsupported')
        expect(api.noticeVisible.value).toBe(true)
    })

    it('AC9 索权只在用户手势：permission=default ⇒ requestPermission 调用 1 次并更新状态', async () => {
        const win = makeWin('default')
        const api = useReminderSettings({ win, now: () => NOON })

        await api.requestPermission()

        expect(win.Notification?.requestPermission).toHaveBeenCalledTimes(1)
    })

    it('AC9 denied ⇒ 不调 requestPermission（浏览器也不会再弹，避免无意义打扰）', () => {
        const win = makeWin('denied')
        const api = useReminderSettings({ win, now: () => NOON })

        api.requestPermission()

        expect(win.Notification?.requestPermission).not.toHaveBeenCalled()
    })

    it('AC9 unsupported ⇒ 不调 requestPermission（无 API 可调）', () => {
        const api = useReminderSettings({ win: makeWin(null), now: () => NOON })

        expect(() => api.requestPermission()).not.toThrow()
        expect(api.status.value).toBe('unsupported')
    })

    it('AC9 真实发送失败降级（Android Chrome 有对象但构造抛错）⇒ markUnsupported 后不再索权', () => {
        const win = makeWin('default')
        const api = useReminderSettings({ win, now: () => NOON })

        api.markUnsupported()
        api.requestPermission()

        expect(api.status.value).toBe('unsupported')
        expect(win.Notification?.requestPermission).not.toHaveBeenCalled()
    })
})

describe('T531 · C3 granted 但构造失败 ⇒ 与 unsupported 同口径（声音置灰 + 一次性引导）', () => {
    it('C3 granted ⇒ 声音开关可用、无说明文案', () => {
        const api = useReminderSettings({ win: makeWin('granted'), now: () => NOON })

        expect(api.soundAvailable.value).toBe(true)
        expect(api.soundHintKey.value).toBeNull()
    })

    it('C3 granted 但 markUnsupported（真实构造失败）⇒ 声音置灰 + 说明文案 + 一次性引导', () => {
        const api = useReminderSettings({ win: makeWin('granted'), now: () => NOON })
        expect(api.noticeVisible.value).toBe(false)

        api.markUnsupported()

        expect(api.status.value).toBe('unsupported')
        expect(api.soundAvailable.value).toBe(false)
        expect(api.soundHintKey.value).toBe('settings.reminder.soundUnavailable')
        expect(api.noticeVisible.value).toBe(true) // 一次性引导（同 unsupported）
    })

    it('C3 denied / 无能力 ⇒ 声音同样不可用（避免「开了声音却没通知」的假开关）', () => {
        const denied = useReminderSettings({ win: makeWin('denied'), now: () => NOON })
        expect(denied.soundAvailable.value).toBe(false)
        expect(denied.soundHintKey.value).toBe('settings.reminder.soundUnavailable')

        const none = useReminderSettings({ win: makeWin(null), now: () => NOON })
        expect(none.soundAvailable.value).toBe(false)
        expect(none.soundHintKey.value).toBe('settings.reminder.soundUnavailable')
    })

    it('C3 granted→失败→重开：引导只出现一次（设备级 ack 持久）', () => {
        const first = useReminderSettings({ win: makeWin('granted'), now: () => NOON })
        first.markUnsupported()
        expect(first.noticeVisible.value).toBe(true)
        first.ackNotice()

        const reopened = useReminderSettings({ win: makeWin('granted'), now: () => NOON })
        reopened.markUnsupported()
        expect(reopened.status.value).toBe('unsupported')
        expect(reopened.noticeVisible.value).toBe(false)
    })
})