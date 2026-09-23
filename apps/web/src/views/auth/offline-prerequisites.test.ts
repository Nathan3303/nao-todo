import { describe, expect, it } from 'vite-plus/test'
import { evaluateOfflinePrerequisites } from './offline-prerequisites'

/**
 * C-62：离线进入预检（纯函数；门退役后判据替换）
 * @description 仅本地事实：JWT 可解析 + 本地会话一致 + 本地镜像存在；不涉及网络与昵称缓存。
 *              条件④原 `isUnlocked`（DEF-16 恒假）⇒ 已替换为 `hasLocalMirror`，原因码 `mirror-missing`。
 */

describe('evaluateOfflinePrerequisites - C-62 三条件预检', () => {
    it('全部满足 → ok', () => {
        expect(
            evaluateOfflinePrerequisites({
                jwtUserId: 'u-1',
                sessionUserId: 'u-1',
                hasLocalMirror: true
            })
        ).toEqual({ ok: true })
    })

    it('JWT 不可解析 → jwt-unresolvable', () => {
        expect(
            evaluateOfflinePrerequisites({
                jwtUserId: null,
                sessionUserId: 'u-1',
                hasLocalMirror: true
            })
        ).toEqual({ ok: false, reason: 'jwt-unresolvable' })
    })

    it('本地会话不一致（含会话为空）→ session-mismatch', () => {
        expect(
            evaluateOfflinePrerequisites({
                jwtUserId: 'u-1',
                sessionUserId: 'u-2',
                hasLocalMirror: true
            })
        ).toEqual({ ok: false, reason: 'session-mismatch' })
        expect(
            evaluateOfflinePrerequisites({
                jwtUserId: 'u-1',
                sessionUserId: null,
                hasLocalMirror: true
            })
        ).toEqual({ ok: false, reason: 'session-mismatch' })
    })

    it('本地镜像不存在 → mirror-missing（替换原 locked）', () => {
        expect(
            evaluateOfflinePrerequisites({
                jwtUserId: 'u-1',
                sessionUserId: 'u-1',
                hasLocalMirror: false
            })
        ).toEqual({ ok: false, reason: 'mirror-missing' })
    })

    it('判定优先级：JWT > 会话 > 镜像（首个不满足即返回）', () => {
        expect(
            evaluateOfflinePrerequisites({
                jwtUserId: null,
                sessionUserId: null,
                hasLocalMirror: false
            })
        ).toEqual({ ok: false, reason: 'jwt-unresolvable' })
        expect(
            evaluateOfflinePrerequisites({
                jwtUserId: 'u-1',
                sessionUserId: 'u-2',
                hasLocalMirror: false
            })
        ).toEqual({ ok: false, reason: 'session-mismatch' })
    })
})