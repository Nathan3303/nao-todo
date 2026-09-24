import { describe, expect, it, vi } from 'vite-plus/test'
import { type SingleInstanceAppLike, enforceSingleInstance } from '../single-instance'

/**
 * AC16a / C-57 桌面端单实例锁回归
 *
 * @description 通过注入 mock `app` 断言 `requestSingleInstanceLock` 的成败分支与
 *              「第二实例 ⇒ 聚焦首实例」行为，无需拉起真实 Electron。
 * @see docs/prds/2026-09-23-web-offline-stage1.md（AC16a）
 */

const createMockApp = (hasLock: boolean) => {
    const calls = { request: 0, quit: 0, events: [] as string[] }
    const listeners = new Map<string, () => void>()
    const app: SingleInstanceAppLike = {
        requestSingleInstanceLock: () => {
            calls.request += 1
            return hasLock
        },
        quit: () => {
            calls.quit += 1
        },
        on: (event, listener) => {
            calls.events.push(event)
            listeners.set(event, listener)
            return app
        }
    }
    return { app, listeners, calls }
}

describe('enforceSingleInstance（AC16a）', () => {
    it('取得锁 ⇒ 主实例：返回 true、注册 second-instance、不退出', () => {
        const { app, calls } = createMockApp(true)
        const focusMainWindow = vi.fn()

        expect(enforceSingleInstance(app, { focusMainWindow })).toBe(true)
        expect(calls.request).toBe(1)
        expect(calls.events).toEqual(['second-instance'])
        expect(calls.quit).toBe(0)
    })

    it('未取得锁 ⇒ 第二实例：返回 false、立即 quit、不注册 second-instance', () => {
        const { app, calls } = createMockApp(false)
        const focusMainWindow = vi.fn()

        expect(enforceSingleInstance(app, { focusMainWindow })).toBe(false)
        expect(calls.quit).toBe(1)
        expect(calls.events).toEqual([])
        expect(focusMainWindow).not.toHaveBeenCalled()
    })

    it('二次启动（second-instance 事件）⇒ 聚焦首实例窗口', () => {
        const { app, listeners } = createMockApp(true)
        const focusMainWindow = vi.fn()

        enforceSingleInstance(app, { focusMainWindow })
        listeners.get('second-instance')?.()

        expect(focusMainWindow).toHaveBeenCalledTimes(1)
    })

    it('未注入 focusMainWindow ⇒ second-instance 触发不抛错（首实例无窗口时 no-op）', () => {
        const { app, listeners } = createMockApp(true)

        enforceSingleInstance(app)
        expect(() => listeners.get('second-instance')?.()).not.toThrow()
    })
})