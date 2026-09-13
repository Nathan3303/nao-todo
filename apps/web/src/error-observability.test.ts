// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { App } from 'vue'
import {
    clearShellErrorLog,
    installGlobalErrorObservability,
    readShellErrorLog,
    recordShellError,
    redactSensitive,
    SHELL_ERROR_LOG_CAPACITY,
    SHELL_ERROR_MESSAGE_MAX,
    SHELL_ERROR_STACK_MAX
} from './error-observability'

/**
 * SHELL-05 T3 / C-27：全局未捕获异常可观测
 * @description 覆盖有界缓冲、截断、PII/token 脱敏，与四类钩子（window error /
 *              unhandledrejection / Vue errorHandler / router.onError）的接入。
 */

/** 最小 Vue app 替身（仅 config.errorHandler 可写） */
const makeApp = (): App => ({ config: { errorHandler: undefined } }) as unknown as App

beforeEach(() => {
    clearShellErrorLog()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    delete window.__NAO_ERROR_LOG__
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('recordShellError - 有界缓冲与摘要', () => {
    it('缓冲有界：超过上限淘汰最旧', () => {
        for (let i = 0; i < SHELL_ERROR_LOG_CAPACITY + 5; i++) recordShellError(`src-${i}`, 'x')
        const log = readShellErrorLog()
        expect(log).toHaveLength(SHELL_ERROR_LOG_CAPACITY)
        expect(log[0]!.source).toBe('src-5')
        expect(log[log.length - 1]!.source).toBe(`src-${SHELL_ERROR_LOG_CAPACITY + 4}`)
    })

    it('消息/栈摘要均截断（不落超长原文）', () => {
        const entry = recordShellError('src', new Error('x'.repeat(2000)))
        expect(entry.message.length).toBeLessThanOrEqual(SHELL_ERROR_MESSAGE_MAX + 1)
        expect(entry.stack.length).toBeLessThanOrEqual(SHELL_ERROR_STACK_MAX + 1)
    })
})

describe('redactSensitive - PII/token 脱敏（AC7）', () => {
    it('email / Bearer / JWT / token= 特征被替换', () => {
        expect(redactSensitive('contact a@b.com')).toBe('contact [redacted-email]')
        expect(redactSensitive('Authorization: Bearer abc.def')).toContain('Bearer [redacted]')
        expect(redactSensitive('jwt eyJhbGciOiJIUzI1NiJ9.abc.def')).toContain('[redacted-jwt]')
        expect(redactSensitive('token=supersecret')).toBe('token=[redacted]')
    })

    it('落库条目不含敏感样本原文', () => {
        const entry = recordShellError('src', 'mail a@b.com token=secret123')
        expect(entry.message).not.toContain('a@b.com')
        expect(entry.message).not.toContain('secret123')
    })
})

describe('installGlobalErrorObservability - 四类钩子同源单点', () => {
    it('window error / unhandledrejection / Vue errorHandler / router.onError 均入缓冲', () => {
        const app = makeApp()
        let routerHandler: ((error: unknown) => unknown) | undefined
        const router = {
            onError: (handler: (error: unknown) => unknown) => {
                routerHandler = handler
            }
        }
        installGlobalErrorObservability({ app, router, target: window })

        window.dispatchEvent(
            new ErrorEvent('error', { error: new Error('win-err'), message: 'win-err' })
        )
        const rejection = new Event('unhandledrejection') as Event & { reason?: unknown }
        rejection.reason = new Error('rej-err')
        window.dispatchEvent(rejection)
        app.config.errorHandler?.(new Error('vue-err'), null, 'render')
        routerHandler?.(new Error('router-err'))

        const sources = readShellErrorLog().map((entry) => entry.source)
        expect(sources).toContain('window:error')
        expect(sources).toContain('window:unhandledrejection')
        expect(sources).toContain('vue:errorHandler:render')
        expect(sources).toContain('router:onError')
    })

    it('window.__NAO_ERROR_LOG__ 暴露只读快照（QA 导出）', () => {
        installGlobalErrorObservability({ app: makeApp(), target: window })
        recordShellError('src', 'x')
        expect(window.__NAO_ERROR_LOG__).toHaveLength(1)
        expect(window.__NAO_ERROR_LOG__).toEqual(readShellErrorLog())
    })
})