// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { grantOfflineEntry, isOfflineEntryGranted, revokeOfflineEntry } from './offline-entry'

/**
 * 离线进入会话 flag 断言（SHELL-03 C-25）
 * @description 会话级（内存）、默认未授予、可清；不落盘（刷新即失效 ⇒ 无"粘性绕过"）。
 */
describe('offline-entry 会话 flag（C-25）', () => {
    beforeEach(() => {
        revokeOfflineEntry()
    })

    it('默认未授予；grant 后授予；revoke 后清除', () => {
        expect(isOfflineEntryGranted()).toBe(false)
        grantOfflineEntry()
        expect(isOfflineEntryGranted()).toBe(true)
        revokeOfflineEntry()
        expect(isOfflineEntryGranted()).toBe(false)
    })

    it('不落盘：授予后 localStorage 不新增任何键（刷新即失效）', () => {
        localStorage.clear()
        grantOfflineEntry()
        expect(localStorage.length).toBe(0)
    })
})