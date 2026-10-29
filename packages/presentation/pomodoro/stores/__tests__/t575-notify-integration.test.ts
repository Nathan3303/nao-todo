// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPinia, setActivePinia } from 'pinia'

/**
 * T575 ① 番茄通知接入提醒设置 —— 引擎集成（AC1 / AC2 / AC3 / AC4）
 *
 * @description 用**真实 store + 真实 `localStorage` 设置 + 假定时器**跑通 4 个原有通知点：
 *              专注完成 / 休息即将结束 / 休息结束 / 结束专注。
 *              设置来源假设 = 身份级单键 `REMINDER_SETTINGS`（与 `apps/web` 任务提醒同源，
 *              `getReminderStorage()` 读的就是 `localStorage`）⇒ 若实现改为注入式读取，
 *              只需改本文件顶部的 `applySettings`（单点）。
 *
 * ⚠️ 应用内提示的方法名不作假设：`NueMessage` 的 4 个方法全部指向同一个 spy ⇒
 *    无论实现用 `info` / `success` / `warn` 哪一档，计数与文案断言都成立。
 * @see docs/prds/2026-10-29-pomodoro-notify-title-round.md（§五 通知 · §七 AC1–AC4 · §九 D1/D6）
 */

const hoisted = vi.hoisted(() => ({
    sendNotification: vi.fn(() => true),
    inApp: vi.fn()
}))

vi.mock('@nao-todo/shared/utils/notification', () => ({
    sendNotification: hoisted.sendNotification
}))

vi.mock('nue-ui', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>()
    return {
        ...actual,
        NueMessage: {
            info: hoisted.inApp,
            success: hoisted.inApp,
            warn: hoisted.inApp,
            error: hoisted.inApp
        }
    }
})

import { REMINDER_SETTINGS_STORAGE_KEY } from '@nao-todo/shared/reminder'
import { usePomodoroSessionStore, usePomodoroTimerStore } from '..'

/** 计时时长（与 session store 默认值一致） */
const FOCUS_S = 25 * 60
const BREAK_S = 5 * 60

let timer: ReturnType<typeof usePomodoroTimerStore>
let session: ReturnType<typeof usePomodoroSessionStore>

type Settings = {
    notify: boolean
    sound: boolean
    quietHours: { start: string; end: string } | null
}

/** 写提醒设置（单一改动点：实现若改为注入式读取，只改这里） */
const applySettings = (patch: Partial<Settings> = {}) => {
    const settings: Settings = { notify: true, sound: true, quietHours: null, ...patch }
    localStorage.setItem(REMINDER_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

/** 免打扰区间 22:00–06:00（跨午夜） */
const OVERNIGHT = { start: '22:00', end: '06:00' }

/** 设定设备本地墙钟 */
const setClock = (hour: number, minute: number) =>
    vi.setSystemTime(new Date(2026, 9, 29, hour, minute, 0, 0))

/** 挂一个记录落库的假实现（避免 `pomodoro.recordSaveFailed` 噪声） */
const attachRecordFn = () => {
    const fn = vi.fn(async () => [[], null] as never)
    timer.setCreateRecordFn(fn as never)
    return fn
}

/** 从 idle 起跑一个完整专注（自然完成 ⇒ 进入休息阶段） */
const completeOneFocus = () => {
    timer.start()
    vi.advanceTimersByTime(FOCUS_S * 1000 + 500)
}

/** 全部通知调用的可读文本（title + body） */
const sentTexts = () =>
    hoisted.sendNotification.mock.calls.map((call) =>
        (call as unknown as [string, string]).slice(0, 2).join(' ')
    )

/** 系统通知第 N 次的 options */
const sentOptions = (index: number) =>
    (
        hoisted.sendNotification.mock.calls[index] as unknown as [
            string,
            string,
            { silent?: boolean }
        ]
    )[2]

beforeEach(() => {
    vi.useFakeTimers()
    setClock(12, 0)
    localStorage.clear()
    hoisted.sendNotification.mockClear()
    hoisted.inApp.mockClear()

    setActivePinia(createPinia())
    session = usePomodoroSessionStore()
    session.setFocusDuration(FOCUS_S)
    session.setBreakDuration(BREAK_S)
    session.setSessionsUntilLongBreak(4)
    session.setAutoRest(true)
    session.setAutoStartNextFocusSession(false)
    timer = usePomodoroTimerStore()
    timer.updateConfig()
    attachRecordFn()
})

afterEach(() => {
    timer.destroy()
    vi.restoreAllMocks()
    vi.useRealTimers()
})

describe('T575 ① AC1 主路径：默认设置 ⇒ 系统通知 + silent=false + 无应用内提示', () => {
    it('AC1 专注自然结束 ⇒ 系统通知 1 次（含阶段与时长）、silent=false、应用内提示 0 次', () => {
        completeOneFocus()

        expect(hoisted.sendNotification).toHaveBeenCalledTimes(1)
        expect(sentTexts()[0]).toContain('专注')
        expect(sentTexts()[0]).toContain('25 分钟')
        expect(sentOptions(0).silent).toBe(false)
        expect(hoisted.inApp).not.toHaveBeenCalled()
        expect(timer.phase).toBe('break')
    })

    it('AC1 声音关（sound=false）⇒ 系统通知 silent=true', () => {
        applySettings({ sound: false })
        completeOneFocus()

        expect(hoisted.sendNotification).toHaveBeenCalledTimes(1)
        expect(sentOptions(0).silent).toBe(true)
        expect(hoisted.inApp).not.toHaveBeenCalled()
    })

    it('AC1 结束专注（end）同样走设置：silent 随声音开关，且不进休息', () => {
        applySettings({ sound: false })
        timer.start()
        vi.advanceTimersByTime(60_000)
        timer.end()

        expect(hoisted.sendNotification).toHaveBeenCalledTimes(1)
        expect(sentOptions(0).silent).toBe(true)
        expect(timer.phase).toBe('idle')
    })
})

describe('T575 ① AC2 免打扰命中（跨午夜 22:00–06:00）⇒ 系统通知 0 + 应用内提示', () => {
    it('AC2 23:30 专注结束 ⇒ 系统通知 0 次、应用内 1 条（含阶段与时长）、引擎继续', () => {
        applySettings({ quietHours: OVERNIGHT })
        setClock(23, 30)
        const recordFn = attachRecordFn()

        completeOneFocus()

        expect(hoisted.sendNotification).not.toHaveBeenCalled()
        expect(hoisted.inApp).toHaveBeenCalledTimes(1)
        const text = String((hoisted.inApp.mock.calls[0] as unknown[])[0])
        expect(text).toContain('专注完成')
        expect(text).toContain('25 分钟')
        // 引擎照常流转 + 记录落库
        expect(timer.phase).toBe('break')
        expect(recordFn).toHaveBeenCalledTimes(1)
    })

    it('AC2 05:30（跨午夜后半段）同样降级为应用内提示', () => {
        applySettings({ quietHours: OVERNIGHT })
        setClock(5, 30)

        completeOneFocus()

        expect(hoisted.sendNotification).not.toHaveBeenCalled()
        expect(hoisted.inApp).toHaveBeenCalledTimes(1)
    })

    it('AC2 三个触发点（专注完成 / 休息即将结束 / 休息结束）都降级、系统通知恒 0', () => {
        applySettings({ quietHours: OVERNIGHT })
        session.setAutoStartNextFocusSession(true)
        setClock(23, 30)

        completeOneFocus() // ① 专注完成
        vi.advanceTimersByTime(BREAK_S * 1000) // ② 休息即将结束 + ③ 休息结束

        expect(hoisted.sendNotification).not.toHaveBeenCalled()
        expect(hoisted.inApp.mock.calls.length).toBeGreaterThanOrEqual(3)
        const joined = hoisted.inApp.mock.calls.map((c) => String((c as unknown[])[0])).join(' | ')
        expect(joined).toContain('专注完成')
        expect(joined).toContain('休息')
    })

    it('AC2 同一区间但 12:00 未命中 ⇒ 系统通知照发（区间不误伤白天）', () => {
        applySettings({ quietHours: OVERNIGHT })
        setClock(12, 0)

        completeOneFocus()

        expect(hoisted.sendNotification).toHaveBeenCalledTimes(1)
        expect(hoisted.inApp).not.toHaveBeenCalled()
    })
})

describe('T575 ① AC3 通知开关关闭 ⇒ 系统通知 0、应用内 0、引擎照常', () => {
    it('AC3 notify=false ⇒ 双 0，下一阶段与记录落库不受影响', () => {
        applySettings({ notify: false })
        const recordFn = attachRecordFn()

        completeOneFocus()

        expect(hoisted.sendNotification).not.toHaveBeenCalled()
        expect(hoisted.inApp).not.toHaveBeenCalled()
        expect(timer.phase).toBe('break')
        expect(recordFn).toHaveBeenCalledTimes(1)
    })
})

describe('T575 ① AC4 异常：读设置抛错 ⇒ fail-open（照发、不静音）', () => {
    it('AC4 REMINDER_SETTINGS 读取抛错 ⇒ 系统通知 1 次且 silent=false，不冒泡', () => {
        const original = window.localStorage.getItem.bind(window.localStorage)
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (
            this: Storage,
            key: string
        ) {
            if (key === REMINDER_SETTINGS_STORAGE_KEY) throw new Error('storage unavailable')
            return original(key)
        })

        expect(() => completeOneFocus()).not.toThrow()

        expect(hoisted.sendNotification).toHaveBeenCalledTimes(1)
        // 「不静音」= silent 不得为 true（AC4 口径；AC1 才要求显式 false）
        expect(sentOptions(0)?.silent).not.toBe(true)
        expect(hoisted.inApp).not.toHaveBeenCalled()
        expect(timer.phase).toBe('break')
    })

    it('AC4 设置键损坏（坏 JSON）⇒ 按默认设置照发（不静音）', () => {
        localStorage.setItem(REMINDER_SETTINGS_STORAGE_KEY, '{broken')

        completeOneFocus()

        expect(hoisted.sendNotification).toHaveBeenCalledTimes(1)
        expect(sentOptions(0)?.silent).not.toBe(true)
    })
})