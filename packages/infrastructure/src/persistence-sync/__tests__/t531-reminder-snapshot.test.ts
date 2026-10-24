// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { REMINDER_SETTINGS_STORAGE_KEY } from '@nao-todo/shared/reminder'
import {
    applyUserConfigSnapshot,
    buildUserConfigSnapshot,
    isSnapshotEmpty,
    USER_CONFIG_PREFERENCES_VERSION
} from '../preference-sync'

/**
 * T531 · 偏好快照三处适配（AC11 设置跨设备同步 · 红基线）
 *
 * 契约（架构报告 §2.2/§2.4 + **T530 终签 C4**，
 * `packages/infrastructure/src/persistence-sync/preference-sync.ts`）：
 *
 * - 快照形状增加**可选** `reminder: ReminderSettings | null`（`{ notify, sound, quietHours }`）；
 *   `version` **保持 1**（服务端哑存储不解析；bump 不提供保护）。
 * - **「从未设置」与「显式清空」必须可区分**（C4②，否则清空永远传播不出去）：
 *   - 本地键 **不存在** ⇒ 快照**不带** `reminder` 字段（未表态，不得抹远端）；
 *   - 本地键 **存在** ⇒ 带 `reminder`：值为归一化对象；JSON `null` ⇒ `null`（显式清空，要回传）。
 * - `isSnapshotEmpty`：`reminder` 字段**存在**即视为「有内容」（含 `null` 清除标记）⇒ **false**
 *   （C4①：只改提醒设置也必须入队推送；C4②：清空也要推送）。
 * - `applyUserConfigSnapshot`：**字段存在性驱动**——有值 ⇒ 写本地；显式 `null` ⇒ 清本地；
 *   **字段不存在 ⇒ 本地不动**（C4③：旧端 / 缺字段快照不得覆盖本地值）；非法值 ⇒ 不动（fail-open）。
 *
 * 三处必须同批改（漏任一处即「改了不推送」/「拉不下来」/「清空不生效」，架构报告 §2.4）。
 *
 * @see docs/prds/2026-10-24-reminder-settings.md §五 R8 · §七 AC11 · T530 终签 C4
 */

const SETTINGS = { notify: false, sound: false, quietHours: { start: '22:00', end: '08:00' } }

const writeLocal = (value: unknown): void => {
    localStorage.setItem(REMINDER_SETTINGS_STORAGE_KEY, JSON.stringify(value))
}

const localSettings = (): unknown => {
    const raw = localStorage.getItem(REMINDER_SETTINGS_STORAGE_KEY)
    return raw === null ? null : JSON.parse(raw)
}

beforeEach(() => {
    localStorage.clear()
})

describe('T531 · AC11 buildUserConfigSnapshot', () => {
    it('AC11 本地从未设置 ⇒ 快照**不带** reminder 字段（不得抹远端）', () => {
        const snapshot = buildUserConfigSnapshot(localStorage, null)

        expect('reminder' in snapshot).toBe(false)
    })

    it('AC11 本地有提醒设置 ⇒ 快照带上三项（含跨天免打扰）', () => {
        writeLocal(SETTINGS)

        expect(buildUserConfigSnapshot(localStorage, null).reminder).toEqual(SETTINGS)
    })

    it('C4② 本地显式清空（JSON null）⇒ 快照带 `reminder: null`（清除要传播到远端）', () => {
        writeLocal(null)

        const snapshot = buildUserConfigSnapshot(localStorage, null)

        expect('reminder' in snapshot).toBe(true)
        expect(snapshot.reminder).toBeNull()
    })

    it('AC11 本地坏 JSON ⇒ 视为未设置（不带字段），不抛错', () => {
        localStorage.setItem(REMINDER_SETTINGS_STORAGE_KEY, '{broken')

        expect(() => buildUserConfigSnapshot(localStorage, null)).not.toThrow()
        expect('reminder' in buildUserConfigSnapshot(localStorage, null)).toBe(false)
    })

    it('AC11 本地脏数据（免打扰非法）⇒ 归一为 fail-open 值（开关保留、quietHours=null）', () => {
        writeLocal({ notify: false, sound: true, quietHours: { start: '99:99' } })

        expect(buildUserConfigSnapshot(localStorage, null).reminder).toEqual({
            notify: false,
            sound: true,
            quietHours: null
        })
    })

    it('AC11 快照 version 保持 1（不 bump）', () => {
        expect(buildUserConfigSnapshot(localStorage, null).version).toBe(
            USER_CONFIG_PREFERENCES_VERSION
        )
        expect(USER_CONFIG_PREFERENCES_VERSION).toBe(1)
    })
})

describe('T531 · AC11 isSnapshotEmpty（C4① / C4②）', () => {
    it('C4① 只有提醒设置 ⇒ 非空（必须入队推送，否则改了永远推不出去）', () => {
        writeLocal(SETTINGS)
        const snapshot = buildUserConfigSnapshot(localStorage, null)

        expect(isSnapshotEmpty(snapshot)).toBe(false)
    })

    it('C4② 只有「显式清空」⇒ 仍非空（清除也必须传播）', () => {
        writeLocal(null)
        const snapshot = buildUserConfigSnapshot(localStorage, null)

        expect(isSnapshotEmpty(snapshot)).toBe(false)
    })

    it('AC11 全空（从未设置任何设置）⇒ 空（不产生无意义推送）', () => {
        expect(isSnapshotEmpty(buildUserConfigSnapshot(localStorage, null))).toBe(true)
    })
})

describe('T531 · AC11 applyUserConfigSnapshot（字段存在性驱动 / C4③）', () => {
    it('AC11 远端有 reminder ⇒ 写入本地身份级键（他端设置生效）', () => {
        applyUserConfigSnapshot({ reminder: SETTINGS } as never, localStorage, null)

        expect(localSettings()).toEqual(SETTINGS)
    })

    it('AC11 远端显式 reminder = null ⇒ 清除本地键（他端清空/重置生效）', () => {
        writeLocal(SETTINGS)

        applyUserConfigSnapshot({ reminder: null } as never, localStorage, null)

        expect(localStorage.getItem(REMINDER_SETTINGS_STORAGE_KEY)).toBeNull()
    })

    it('C4③ 远端快照**不含** reminder 字段 ⇒ 本地设置原样保留（不得覆盖/清空）', () => {
        writeLocal(SETTINGS)

        applyUserConfigSnapshot({ asideWidth: '300px' } as never, localStorage, null)

        expect(localSettings()).toEqual(SETTINGS)
    })

    it('AC11 远端非法 reminder（类型不符）⇒ 本地保留、不抛错', () => {
        writeLocal(SETTINGS)

        expect(() =>
            applyUserConfigSnapshot({ reminder: { notify: 'x' } } as never, localStorage, null)
        ).not.toThrow()
        expect(localSettings()).toEqual(SETTINGS)
    })

    it('AC11 远端整快照为 null / undefined（拉取失败）⇒ 本地保留（不覆盖本地）', () => {
        writeLocal(SETTINGS)

        applyUserConfigSnapshot(null, localStorage, null)
        applyUserConfigSnapshot(undefined, localStorage, null)

        expect(localSettings()).toEqual(SETTINGS)
    })

    it('AC11 往返：A 端 build → B 端 apply → B 端 build 等价（两端一致）', () => {
        writeLocal(SETTINGS)
        const snapshot = buildUserConfigSnapshot(localStorage, null)

        localStorage.clear()
        applyUserConfigSnapshot(snapshot as never, localStorage, null)

        expect(buildUserConfigSnapshot(localStorage, null).reminder).toEqual(SETTINGS)
    })

    it('AC11 存储不可用（读写抛错）⇒ 静默降级，不抛错', () => {
        const storage = {
            getItem: () => {
                throw new Error('unavailable')
            },
            setItem: () => {
                throw new Error('unavailable')
            },
            removeItem: () => {
                throw new Error('unavailable')
            },
            key: () => null,
            length: 0
        }

        expect(() =>
            applyUserConfigSnapshot({ reminder: SETTINGS } as never, storage, null)
        ).not.toThrow()
    })
})