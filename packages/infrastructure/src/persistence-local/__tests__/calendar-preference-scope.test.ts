// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import {
    DEVICE_LEVEL_STORAGE_KEYS,
    USER_SCOPED_STORAGE_KEYS,
    clearUserScopedLocalStorage
} from '../deletion/local-storage-policy'

/**
 * TASK-26 PS-6 —— `CALENDAR_WEEKSTART` 设备级 → 用户级（AC5 清库语义）
 *
 * **验收判据**（ADR r2 §PS-6 / PRD Q3′ 用户裁定）：
 * - `CALENDAR_WEEKSTART` **不得**再在 `DEVICE_LEVEL_STORAGE_KEYS`（否则登出保留 ⇒ 切换账号串号）；
 * - **必须**在身份级（`USER_SCOPED_STORAGE_KEYS`）⇒ 登出/切换账号**被清**，登录后由服务端拉回；
 * - **回归**：其它设备级键（如 `nao.deviceId`）仍保留。
 *
 * **红窗口**：前 2 例（名单）与第 3 例的周起始断言预期**红**；设备键保留断言预期**绿**。
 */

const CALENDAR_WEEKSTART = 'CALENDAR_WEEKSTART'

describe('PS-6 CALENDAR_WEEKSTART 设备级 → 用户级（红基线）', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('名单：不在 DEVICE_LEVEL_STORAGE_KEYS', () => {
        expect(DEVICE_LEVEL_STORAGE_KEYS).not.toContain(CALENDAR_WEEKSTART)
    })

    it('名单：在 USER_SCOPED_STORAGE_KEYS', () => {
        expect(USER_SCOPED_STORAGE_KEYS).toContain(CALENDAR_WEEKSTART)
    })

    it('行为：登出清库清除周起始（红基线）', () => {
        localStorage.setItem(CALENDAR_WEEKSTART, 'sunday')

        clearUserScopedLocalStorage()

        expect(localStorage.getItem(CALENDAR_WEEKSTART)).toBeNull()
    })

    it('回归：其它设备级键仍保留、身份级键仍清（预期绿）', () => {
        localStorage.setItem('nao.deviceId', 'device-1')
        localStorage.setItem('USER_JWT', 'jwt')

        clearUserScopedLocalStorage()

        expect(localStorage.getItem('nao.deviceId')).toBe('device-1')
        expect(localStorage.getItem('USER_JWT')).toBeNull()
    })
})