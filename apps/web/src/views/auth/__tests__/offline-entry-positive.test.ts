import { describe, expect, it } from 'vite-plus/test'
import { evaluateOfflinePrerequisites } from '../offline-prerequisites'

/**
 * DEF-16 / AC15 回归线 —— 门退役后「离线进入」**正向可达**
 *
 * **验收判据**（PRD §7 AC15）：`G` 解锁门**已退役** ／ `W` 离线冷启动 ／
 * `T` 离线进入**正向可达**（**非**仅 `isUnlocked = false` 的拒绝路径）。
 *
 * **现状缺陷**（ADR C-62 / DEF-16）：`isUnlocked` getter = `dek !== null`，而 `dek` 只由
 * `setup()/unlock()` 置位 ⇒ **退役 `UnlockGate` 后恒假** ⇒ 桌面「离线进入」**永久不可达**
 * （silent dead code；现有测试**全部 mock 成 `true`**，只覆盖拒绝路径 ⇒ 无守护）。
 *
 * **C-62 新判据**（本文件锁定的契约）：
 * `offlineEntryGranted && JWT 可解析 && localSession.getCurrentUserId() === jwtUserId && 本地镜像存在`
 * ⇒ 预检入参由 `isUnlocked: boolean` 改为 **`hasLocalMirror: boolean`**，
 * 失败原因码由 `'locked'` 改为 **`'mirror-missing'`**。
 *
 * ⚠️ 本文件只锁**纯函数决策核**（两处实现共用）：守卫接线（`routes.ts`）与
 * `checkOfflineEntryPrerequisites()` 的镜像探测 API **尚未定名**，故不在此处猜测；
 * 该接线由 T104 与实现同批补测（C-62「两处实现同步改」）。
 */

/** C-62 新判据入参（删条件④ `isUnlocked`，改「本地镜像存在」） */
type OfflineEntryInput = {
    jwtUserId: string | null
    sessionUserId: string | null
    hasLocalMirror: boolean
}

/**
 * 红基线桥接：当前签名仍要求 `isUnlocked: boolean`。
 * T104 替换签名后**必须删除本 cast**（届时可直接传 `OfflineEntryInput`）。
 */
const evaluate = (input: OfflineEntryInput) =>
    evaluateOfflinePrerequisites(
        input as unknown as Parameters<typeof evaluateOfflinePrerequisites>[0]
    )

describe('DEF-16 / AC15：离线进入正向可达（C-62 新判据）', () => {
    it('正向：JWT 可解析 + 会话一致 + 本地镜像存在 ⇒ ok（门退役后仍可达）', () => {
        expect(evaluate({ jwtUserId: 'u-1', sessionUserId: 'u-1', hasLocalMirror: true })).toEqual({
            ok: true
        })
    })

    it('本地镜像不存在 ⇒ mirror-missing（替换原 locked）', () => {
        expect(evaluate({ jwtUserId: 'u-1', sessionUserId: 'u-1', hasLocalMirror: false })).toEqual(
            { ok: false, reason: 'mirror-missing' }
        )
    })

    it('保留项：JWT 不可解析 ⇒ jwt-unresolvable', () => {
        expect(evaluate({ jwtUserId: null, sessionUserId: 'u-1', hasLocalMirror: true })).toEqual({
            ok: false,
            reason: 'jwt-unresolvable'
        })
    })

    it('保留项：会话不一致（含会话为空）⇒ session-mismatch', () => {
        expect(evaluate({ jwtUserId: 'u-1', sessionUserId: 'u-2', hasLocalMirror: true })).toEqual({
            ok: false,
            reason: 'session-mismatch'
        })
        expect(evaluate({ jwtUserId: 'u-1', sessionUserId: null, hasLocalMirror: true })).toEqual({
            ok: false,
            reason: 'session-mismatch'
        })
    })

    it('判定优先级：JWT > 会话 > 镜像（首个不满足即返回）', () => {
        expect(evaluate({ jwtUserId: null, sessionUserId: null, hasLocalMirror: false })).toEqual({
            ok: false,
            reason: 'jwt-unresolvable'
        })
        expect(evaluate({ jwtUserId: 'u-1', sessionUserId: null, hasLocalMirror: false })).toEqual({
            ok: false,
            reason: 'session-mismatch'
        })
    })

    it('条件④已删：失败原因码集合中不再存在 locked', () => {
        const reasons = [
            evaluate({ jwtUserId: null, sessionUserId: 'u-1', hasLocalMirror: true }),
            evaluate({ jwtUserId: 'u-1', sessionUserId: 'u-2', hasLocalMirror: true }),
            evaluate({ jwtUserId: 'u-1', sessionUserId: 'u-1', hasLocalMirror: false })
        ].map((result) => (result.ok ? 'ok' : result.reason))
        expect(reasons).not.toContain('locked')
    })
})