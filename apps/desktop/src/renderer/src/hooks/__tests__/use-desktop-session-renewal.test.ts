// @vitest-environment jsdom
import { reactive } from 'vue'
import { describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'

/**
 * Issue #260 修复④回归：续期调度器只在「已认证 && 有凭证」时启动
 *
 * @description 旧实现只判 `authToken()` ⇒ 冷启动（JWT 在 localStorage、未检入）也会启动
 *              ⇒ 与检入页双发 checkin ⇒ 服务端轮换旧 token ⇒ 在途请求 10041 自伤登出
 *              ⇒「登录成功但卡在登录页」家族。修复后 watch 源 = `[isAuthenticated, token]`，
 *              登出/切号/未检入均不启动、登出即停。
 */

const captured = vi.hoisted(() => ({
    starts: 0,
    stops: 0
}))

vi.mock('../../desktop-bridge', () => ({
    getDesktopBridge: () => ({
        isDesktop: true,
        platform: 'linux',
        versions: { electron: '31', chrome: '120', node: '20' },
        getShellStatus: async () => ({ tray: 'available', autostart: 'enabled' }),
        setAutostart: async () => ({ autostart: 'enabled' }),
        showMainWindow: async () => undefined,
        quit: async () => undefined,
        onPowerResume: () => () => undefined
    })
}))

vi.mock('@nao-todo/shared/session-renewal', () => ({
    createRenewalScheduler: () => ({
        start: vi.fn(async () => {
            captured.starts += 1
        }),
        stop: vi.fn(() => {
            captured.stops += 1
        }),
        trigger: vi.fn(async () => undefined),
        lastSuccessAt: () => null,
        nextAttemptAt: () => null,
        isRunning: () => true
    }),
    getLastCheckInAttemptAt: () => null
}))

import { useDesktopSessionRenewal } from '../use-desktop-session-renewal'

/** 挂一个使用续期接线的最小组件（options 经闭包对象响应式驱动） */
const mountRenewal = (initial: { authed: boolean; token: string }) => {
    const state = reactive({ ...initial })
    const wrapper = mount({
        setup() {
            useDesktopSessionRenewal({
                isAuthenticated: () => state.authed,
                authToken: () => state.token,
                checkIn: async () => null,
                onCredentialExpired: () => undefined
            })
            return {}
        },
        template: '<div />'
    })
    return { wrapper, state }
}

describe('Issue #260 修复④：续期调度器启动条件 = isAuthenticated && token', () => {
    it('冷启动：有 JWT 但未认证 ⇒ 不启动（不与检入页双发 checkin）', () => {
        const { wrapper } = mountRenewal({ authed: false, token: 'jwt-cold' })
        expect(captured.starts).toBe(0)
        wrapper.unmount()
    })

    it('已认证且有凭证 ⇒ 启动；登出（任一条件消失）⇒ 停；重新登录 ⇒ 再启动', async () => {
        const { wrapper, state } = mountRenewal({ authed: false, token: '' })
        expect(captured.starts).toBe(0)

        // 登录完成（signIn 成功：authed + token 同时成立）
        state.authed = true
        state.token = 'jwt-1'
        await wrapper.vm.$nextTick()
        expect(captured.starts).toBeGreaterThanOrEqual(1)

        // 登出（清凭证 + authed=false）⇒ 停
        state.authed = false
        state.token = ''
        await wrapper.vm.$nextTick()
        expect(captured.stops).toBeGreaterThanOrEqual(1)

        // 重新登录 ⇒ 再启动
        state.authed = true
        state.token = 'jwt-2'
        await wrapper.vm.$nextTick()
        expect(captured.starts).toBeGreaterThanOrEqual(2)
        wrapper.unmount()
    })

    it('卸载 ⇒ 停（防后台幽灵续期）', async () => {
        const { wrapper } = mountRenewal({ authed: true, token: 'jwt-1' })
        await wrapper.vm.$nextTick()
        const stopsBefore = captured.stops
        wrapper.unmount()
        expect(captured.stops).toBeGreaterThan(stopsBefore)
    })
})