import { describe, expect, it } from 'vite-plus/test'
import { evaluateOfflinePrerequisites } from './offline-prerequisites'

/**
 * SHELL-05 T6 / C-29：离线进入四条件预检（纯函数）
 * @description 仅本地事实：JWT 可解析 + 本地会话一致 + 已解锁；不涉及网络与昵称缓存。
 */

describe('evaluateOfflinePrerequisites - C-29 四条件预检', () => {
    it('全部满足 → ok', () => {
        expect(
            evaluateOfflinePrerequisites({
                jwtUserId: 'u-1',
                sessionUserId: 'u-1',
                isUnlocked: true
            })
        ).toEqual({ ok: true })
    })

    it('JWT 不可解析 → jwt-unresolvable', () => {
        expect(
            evaluateOfflinePrerequisites({
                jwtUserId: null,
                sessionUserId: 'u-1',
                isUnlocked: true
            })
        ).toEqual({ ok: false, reason: 'jwt-unresolvable' })
    })

    it('本地会话不一致（含会话为空）→ session-mismatch', () => {
        expect(
            evaluateOfflinePrerequisites({
                jwtUserId: 'u-1',
                sessionUserId: 'u-2',
                isUnlocked: true
            })
        ).toEqual({ ok: false, reason: 'session-mismatch' })
        expect(
            evaluateOfflinePrerequisites({
                jwtUserId: 'u-1',
                sessionUserId: null,
                isUnlocked: true
            })
        ).toEqual({ ok: false, reason: 'session-mismatch' })
    })

    it('未解锁 → locked', () => {
        expect(
            evaluateOfflinePrerequisites({
                jwtUserId: 'u-1',
                sessionUserId: 'u-1',
                isUnlocked: false
            })
        ).toEqual({ ok: false, reason: 'locked' })
    })

    it('判定优先级：JWT > 会话 > 解锁（首个不满足即返回）', () => {
        expect(
            evaluateOfflinePrerequisites({
                jwtUserId: null,
                sessionUserId: null,
                isUnlocked: false
            })
        ).toEqual({ ok: false, reason: 'jwt-unresolvable' })
        expect(
            evaluateOfflinePrerequisites({
                jwtUserId: 'u-1',
                sessionUserId: 'u-2',
                isUnlocked: false
            })
        ).toEqual({ ok: false, reason: 'session-mismatch' })
    })
})