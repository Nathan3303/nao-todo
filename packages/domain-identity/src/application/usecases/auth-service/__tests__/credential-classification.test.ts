import { describe, expect, it } from 'vite-plus/test'
import * as classification from '../error-classification'
import { isCredentialError, isNetworkError } from '../error-classification'
import type { GoError } from '@nao-todo/shared/types/golang'

/**
 * T589 红基线 —— 凭证失效口径收口（AC1 单一判据 / AC2 网络·业务不登出）
 *
 * 契约（ADR D1，`docs/adr/2026-10-31-credential-coherence.md`）：
 * - `AUTH_CREDENTIAL_CODES = [10041, 10042]`（**唯一**凭证码集合，各层引用、禁止各自 switch）；
 * - `classifyAuthFailure({ code? , err? })` ⇒ `'credential' | 'network' | 'business'`
 *     - `10041` / `10042` ⇒ `credential`
 *     - `NETWORK_ERROR_CODES`（`ERR_NETWORK` / `ECONNABORTED` / `50300` / `40800` / `42900` / `10051`）⇒ `network`
 *     - 其余（`10022` / 5xx / 未知 / 无信号）⇒ `business`
 * - `decideSessionEnd({ source, code? , err? })` ⇒ 真值 = 结束会话：
 *     - `source: 'passive'`（被动响应投影）**仅** credential ⇒ 结束；network / business ⇒ **不结束**（AC2 / C-67）
 *     - `source: 'active'`（主动校验）沿用 C-67 fail-closed：credential / 未知 ⇒ 结束，network ⇒ 不结束
 * - `isCredentialError` / `isNetworkError` **语义逐字不变**（C-67 / r12 回归护栏）
 *
 * 状态：**红**（`AUTH_CREDENTIAL_CODES` / `classifyAuthFailure` / `decideSessionEnd` 尚未实现）。
 * 变异易感：把网络码并入凭证集 ⇒ AC2 红；把 `10042` 漏出凭证集 ⇒ AC1 红。
 */

type AuthFailureClass = 'credential' | 'network' | 'business'
type SessionEndDecision = unknown

type ClassifierModule = {
    AUTH_CREDENTIAL_CODES?: readonly (string | number)[]
    classifyAuthFailure?: (input: { code?: string | number; err?: GoError }) => AuthFailureClass
    decideSessionEnd?: (input: {
        source: 'active' | 'passive'
        code?: string | number
        err?: GoError
    }) => SessionEndDecision
}

type LoadedClassifier = {
    AUTH_CREDENTIAL_CODES: readonly (string | number)[]
    classifyAuthFailure: NonNullable<ClassifierModule['classifyAuthFailure']>
    decideSessionEnd: NonNullable<ClassifierModule['decideSessionEnd']>
}

/** 缺实现装载器（红基线：给出「缺实现」原因而不是模块解析栈） */
const load = (ac: string): LoadedClassifier => {
    const mod = classification as unknown as ClassifierModule
    const missing = ['AUTH_CREDENTIAL_CODES', 'classifyAuthFailure', 'decideSessionEnd'].filter(
        (name) => typeof mod[name as keyof ClassifierModule] === 'undefined'
    )
    if (missing.length > 0) {
        throw new Error(
            `[缺实现] ${'packages/domain-identity/src/application/usecases/auth-service/error-classification.ts'} 缺少导出：${missing.join('、')}（${ac}）`
        )
    }
    return mod as LoadedClassifier
}

/** `decideSessionEnd` 返回形态容忍（`true` / `'logout'` / `'end-session'` 均视为结束会话） */
const isLogout = (decision: SessionEndDecision): boolean =>
    decision === true || decision === 'logout' || decision === 'end-session' || decision === 'end'

/** 构造携带业务码的抛出型错误（仓储透传形态） */
const businessError = (code: string | number): Error =>
    Object.assign(new Error(`business ${code}`), { businessCode: code })

describe('AC1：凭证码集合唯一 + 三分类表', () => {
    it('凭证码集合恰为 {10041, 10042}', () => {
        const { AUTH_CREDENTIAL_CODES } = load('AC1')
        expect([...AUTH_CREDENTIAL_CODES].sort((a, b) => Number(a) - Number(b))).toEqual([
            10041, 10042
        ])
    })

    it('10041/10042（code 或 businessCode 形态）⇒ credential', () => {
        const { classifyAuthFailure } = load('AC1')
        expect(classifyAuthFailure({ code: 10041 })).toBe('credential')
        expect(classifyAuthFailure({ code: 10042 })).toBe('credential')
        expect(classifyAuthFailure({ err: businessError(10041) })).toBe('credential')
        expect(
            classifyAuthFailure({
                err: Object.assign(new Error('x'), { businessCode: 10042 })
            })
        ).toBe('credential')
    })

    it('6 个网络码（字符串 / 数字）⇒ network', () => {
        const { classifyAuthFailure } = load('AC1')
        const networkCodes: (string | number)[] = [
            'ERR_NETWORK',
            'ECONNABORTED',
            50300,
            40800,
            42900,
            10051
        ]
        for (const code of networkCodes) {
            expect(classifyAuthFailure({ code }), `code=${String(code)}`).toBe('network')
            expect(
                classifyAuthFailure({ err: businessError(code) }),
                `businessCode=${String(code)}`
            ).toBe('network')
        }
    })

    it('业务类（10022 / 5xx / 未知 / 空信号）⇒ business', () => {
        const { classifyAuthFailure } = load('AC1')
        expect(classifyAuthFailure({ code: 10022 })).toBe('business')
        expect(classifyAuthFailure({ code: 10031 })).toBe('business')
        expect(
            classifyAuthFailure({
                err: Object.assign(new Error('Internal Server Error'), {
                    response: { status: 500 }
                })
            })
        ).toBe('business')
        expect(classifyAuthFailure({ code: 99999 })).toBe('business')
        expect(classifyAuthFailure({ err: null })).toBe('business')
    })
})

describe('AC2：被动投影下网络类 / 业务类不结束会话（C-67 口径不回归）', () => {
    it('网络类 6 个码 ⇒ passive 不登出', () => {
        const { decideSessionEnd } = load('AC2')
        const networkCodes: (string | number)[] = [
            'ERR_NETWORK',
            'ECONNABORTED',
            50300,
            40800,
            42900,
            10051
        ]
        for (const code of networkCodes) {
            expect(
                isLogout(decideSessionEnd({ source: 'passive', code })),
                `passive network code=${String(code)}`
            ).toBe(false)
        }
    })

    it('业务类（10022 / 未知 / 5xx）⇒ passive 不登出', () => {
        const { decideSessionEnd } = load('AC2')
        expect(isLogout(decideSessionEnd({ source: 'passive', code: 10022 }))).toBe(false)
        expect(isLogout(decideSessionEnd({ source: 'passive', code: 99999 }))).toBe(false)
        expect(
            isLogout(
                decideSessionEnd({
                    source: 'passive',
                    err: Object.assign(new Error('5xx'), { response: { status: 502 } })
                })
            )
        ).toBe(false)
    })

    it('凭证类（10041/10042）⇒ passive 登出（含 10042 —— DEF-90 漏判修复）', () => {
        const { decideSessionEnd } = load('AC2')
        expect(isLogout(decideSessionEnd({ source: 'passive', code: 10041 }))).toBe(true)
        expect(isLogout(decideSessionEnd({ source: 'passive', code: 10042 }))).toBe(true)
    })

    it('主动校验沿用 C-67 fail-closed：未知 ⇒ 登出，网络 ⇒ 保持', () => {
        const { decideSessionEnd } = load('AC2')
        expect(isLogout(decideSessionEnd({ source: 'active', code: 10041 }))).toBe(true)
        expect(isLogout(decideSessionEnd({ source: 'active', code: 99999 }))).toBe(true)
        expect(isLogout(decideSessionEnd({ source: 'active', code: 'ERR_NETWORK' }))).toBe(false)
    })

    it('既有 isCredentialError 方向未被改（未知 ⇒ 凭证；网络 ⇒ 非凭证）', () => {
        expect(isCredentialError(businessError(99999))).toBe(true)
        expect(isCredentialError(businessError('ERR_NETWORK'))).toBe(false)
        expect(isNetworkError(businessError(10051))).toBe(true)
        expect(isNetworkError(businessError(10041))).toBe(false)
    })
})