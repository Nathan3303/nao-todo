// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import {
    isReadOnly,
    resetReadOnlyForTest,
    setOffline,
    setOfflineEntryActive
} from '@nao-todo/presentation/offline'
import { applySyncConfirmation, isSessionConfirmed } from './offline-read-only'

/**
 * 会话级「离线进入」flag 生命周期断言（C-59 / AC10 / ADR-r5.1）
 * @description 判据 = `ok === true && !credentialFailure && pullExecuted === true`。
 *              ⚠️ **不得**用 `ok` / `lastSyncAt` 反推「会话已确认」—— `start()` 在注销宽限期与
 *              `!userId` 时早退仍报 `ok=true`（空运行）。故负向用例必须覆盖这两种空运行。
 */

describe('isSessionConfirmed - ADR-r5.1 判据', () => {
    it('真实成功同步（ok && !credentialFailure && pullExecuted）⇒ 确认', () => {
        expect(isSessionConfirmed({ ok: true, credentialFailure: false, pullExecuted: true })).toBe(
            true
        )
    })

    it('ok=false ⇒ 不确认', () => {
        expect(
            isSessionConfirmed({ ok: false, credentialFailure: false, pullExecuted: true })
        ).toBe(false)
    })

    it('credentialFailure=true ⇒ 不确认（会话失效不得据此解除只读）', () => {
        expect(isSessionConfirmed({ ok: true, credentialFailure: true, pullExecuted: true })).toBe(
            false
        )
    })
})

describe('applySyncConfirmation - flag 生命周期', () => {
    beforeEach(() => {
        resetReadOnlyForTest()
    })

    it('负向：注销宽限期早退的空运行（ok=true, pullExecuted=false）⇒ flag 不得清除', () => {
        setOfflineEntryActive(true)
        expect(isReadOnly()).toBe(true)

        applySyncConfirmation({ ok: true, credentialFailure: false, pullExecuted: false })

        expect(isReadOnly()).toBe(true)
    })

    it('负向：!userId 空运行（ok=true, pullExecuted=false）⇒ flag 不得清除', () => {
        setOfflineEntryActive(true)
        applySyncConfirmation({ ok: true, credentialFailure: false, pullExecuted: false })
        expect(isReadOnly()).toBe(true)
    })

    it('真实成功同步 ⇒ 清除 flag ⇒ 恢复可写', () => {
        setOfflineEntryActive(true)
        expect(isReadOnly()).toBe(true)

        applySyncConfirmation({ ok: true, credentialFailure: false, pullExecuted: true })

        expect(isReadOnly()).toBe(false)
    })

    it('清除后 navigator.onLine 兜底：再次断网 ⇒ 立即回只读', () => {
        setOfflineEntryActive(true)
        applySyncConfirmation({ ok: true, credentialFailure: false, pullExecuted: true })
        expect(isReadOnly()).toBe(false)

        setOffline(true)
        expect(isReadOnly()).toBe(true)
    })
})