import { describe, expect, it } from 'vite-plus/test'
import { UserEntity } from '../user'

/**
 * DEF-39：客户端把 `state` 当角色
 * @description 服务端 `state` 是**账户状态**（`0=active` / `1=deactivated`），
 *              `role` 才是角色字段。历史上 `isAdmin: state === 1` / `isVIP: state === 2`
 *              把账户状态误当角色（且 `state === 2` 服务端根本不存在）⇒ 本用例锁死
 *              「`state` 不再派生 admin/VIP 语义」。
 */

const makeUser = (overrides: { role?: string; state?: number } = {}): UserEntity =>
    new UserEntity(
        'u1',
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z',
        null,
        'user@example.com',
        'nick',
        'avatar',
        'web',
        overrides.role ?? '',
        overrides.state ?? 0,
        '',
        ''
    )

/** 以「可能残留的旧 getter」视角读取角色派生字段（当前实现应已不存在） */
const roleFlagsOf = (user: UserEntity): { isAdmin?: unknown; isVIP?: unknown } =>
    user as unknown as { isAdmin?: unknown; isVIP?: unknown }

describe('DEF-39 UserEntity：state 是账户状态，不派生角色', () => {
    it('active(0) / deactivated(1) 均不再产出 isAdmin / isVIP', () => {
        const active = makeUser({ state: 0 })
        const deactivated = makeUser({ state: 1 })

        // 修复前：state === 1 使 isAdmin === true（把「已注销」误判为「管理员」）
        expect(roleFlagsOf(active).isAdmin).toBeUndefined()
        expect(roleFlagsOf(active).isVIP).toBeUndefined()
        expect(roleFlagsOf(deactivated).isAdmin).toBeUndefined()
        expect(roleFlagsOf(deactivated).isVIP).toBeUndefined()
    })

    it('state 原样透传（账户状态语义不被篡改）', () => {
        expect(makeUser({ state: 0 }).state).toBe(0)
        expect(makeUser({ state: 1 }).state).toBe(1)
    })

    it('role 为独立字段，原样透传（角色来源与服务端字段对齐）', () => {
        expect(makeUser({ role: 'admin' }).role).toBe('admin')
        expect(makeUser({ role: '' }).role).toBe('')
    })
})