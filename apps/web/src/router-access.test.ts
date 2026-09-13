import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Router } from 'vue-router'
import {
    ROUTER_INJECTION_LOG_PREFIX,
    reportRouterInjection,
    selectRouter,
    type RouterResolution
} from './router-access'

/**
 * SHELL-05 T1 / C-37：实例无关 router 访问纯层
 * @description 覆盖 composable 优先 / $router 降级 / 全缺三态，以及自检日志可观测性。
 */

/** 最小 Router 替身（仅需标识来源） */
const fakeRouter = (tag: string): Router => ({ tag }) as unknown as Router

describe('selectRouter - C-37② 三态选择', () => {
    it('composable 可用 → 优先 composable（健康路径）', () => {
        const composable = fakeRouter('composable')
        const global = fakeRouter('global')
        expect(selectRouter(composable, global)).toEqual({
            router: composable,
            source: 'composable'
        })
    })

    it('useRouter() 返回 undefined → 回退 app 级 $router', () => {
        const global = fakeRouter('global')
        expect(selectRouter(undefined, global)).toEqual({ router: global, source: 'global' })
    })

    it('两者皆无 → none（调用方须显式告警，不得静默）', () => {
        expect(selectRouter(undefined, undefined)).toEqual({
            router: undefined,
            source: 'none'
        })
    })
})

describe('reportRouterInjection - C-37① 自检可观测', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('composable 路径不产生告警', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        reportRouterInjection({ router: fakeRouter('c'), source: 'composable' })
        expect(spy).not.toHaveBeenCalled()
    })

    it('global 降级路径输出固定前缀结构化日志', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const resolution: RouterResolution = { router: fakeRouter('g'), source: 'global' }
        reportRouterInjection(resolution)
        expect(spy).toHaveBeenCalledWith(
            expect.stringContaining(ROUTER_INJECTION_LOG_PREFIX),
            expect.objectContaining({ source: 'global' })
        )
    })

    it('none 路径输出固定前缀结构化日志', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        reportRouterInjection({ router: undefined, source: 'none' })
        expect(spy).toHaveBeenCalledWith(
            expect.stringContaining(ROUTER_INJECTION_LOG_PREFIX),
            expect.objectContaining({ source: 'none' })
        )
    })
})