// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { NueButton, NueContainer, NueDiv, NueMain, NueText } from 'nue-ui'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import CheckIn from '../check-in.vue'

/**
 * T596 红基线 —— AC6 / AC7：检入冲突 `10022` 的分类与主次动作（`DEF-119`）
 *
 * 缺陷现场（用户 2026-10-31 真机）：Web 改密 ⇒ 服务端撤销其它设备会话（SEC-03）⇒ 桌面刷新
 * 检入得 `10022` ⇒ 一律显示「验证未完成，请重试」：不说明原因、默认动作（重试）无效。
 *
 * 判据（文案按**语义关键词**，不钉整句 —— 文案定稿以 PRD §九 + 提交内 zh/en 为准）：
 * - AC6：`10022` + token **未过期** ⇒ 文案含「密码」/「其它设备」语义；**主按钮 = 重新登录**，
 *   次按钮 = 重试（DOM 顺序即用户看到的主次；`PROPS` 视觉主按钮由 rd-fe 用既有 token 保证，AC11）。
 * - AC7：`10022` + token **已过期** ⇒ 走过期语义（含「过期」，**不得**说「密码被改」）；
 *   短时并发检入（连续两次 `10022`）⇒ 仍以**重试**为主，文案不夸大为「密码被改」。
 * - 通用：不暴露错误码（`10022`/`10041`）与内部键名（R1）；`10022` 不跳登录页（T558 R1 不回归）。
 *
 * 状态：**红**（当前 `10022` 恒为 `auth.checkIn.conflict`「验证未完成，请重试」，重试恒为主）。
 * 变异易感：改回单一文案 ⇒ AC6/AC7 红；对调主次按钮 ⇒ AC6 红；并发分支删掉 ⇒ AC7 两条之一红。
 */

const mocks = vi.hoisted(() => ({
    replace: vi.fn(),
    messageError: vi.fn(),
    routeName: 'auth-checkin'
}))

vi.mock('vue-router', () => ({
    useRouter: () => ({ replace: mocks.replace }),
    useRoute: () => ({
        get name() {
            return mocks.routeName
        }
    })
}))

vi.mock('nue-ui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('nue-ui')>()
    return { ...actual, NueMessage: { error: mocks.messageError } }
})

const CONFLICT_CODE = 10022

const nowSeconds = (): number => Math.floor(Date.now() / 1000)

const makeJwt = (expSeconds: number): string => {
    const payload = { Id: '422644611870101504', exp: expSeconds, iss: 'NaoTodoServer' }
    const encoded = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encoded}.sig`
}

const conflictError = (code = CONFLICT_CODE): Error =>
    Object.assign(new Error('检入失败'), { code, businessCode: code })

let wrapper: VueWrapper | null = null

const mountCheckIn = (checkIn: () => Promise<unknown>): VueWrapper => {
    wrapper = mount(CheckIn, {
        attachTo: document.body,
        props: {
            authUseCase: { checkIn } as never,
            loadingText: '正在验证用户凭据，请稍后 ...'
        },
        global: {
            components: {
                'nue-container': NueContainer,
                'nue-main': NueMain,
                'nue-div': NueDiv,
                'nue-text': NueText,
                'nue-button': NueButton
            }
        }
    })
    return wrapper
}

const buttons = (): string[] =>
    [...document.querySelectorAll('button')].map((b) => b.textContent?.trim() ?? '')

const clickButton = (label: string): void => {
    const target = [...document.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === label
    )
    target?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

const bodyText = (): string => document.body.textContent ?? ''

beforeEach(() => {
    localStorage.clear()
    mocks.replace.mockClear()
    mocks.messageError.mockClear()
    mocks.routeName = 'auth-checkin'
})

afterEach(async () => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    const window = await import('@nao-todo/shared/requester/checkin-window')
    window.resetCheckInWindow()
})

describe('AC6：10022 + token 未过期 ⇒ 说明原因 + 重新登录为主', () => {
    it('文案含「密码 / 其它设备」语义，主按钮 = 重新登录、次按钮 = 重试', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, makeJwt(nowSeconds() + 3600))
        mountCheckIn(async () => conflictError())
        await flushPromises()

        const text = bodyText()
        expect(
            text,
            `检入冲突在 token 未过期时应说明「密码可能在其它设备修改 / 会话被撤销」；实测：${text}`
        ).toMatch(/密码|其它设备|其他设备/)
        expect(buttons()[0], `主按钮应为「重新登录」；实测顺序：${buttons().join(' / ')}`).toBe(
            '重新登录'
        )
        expect(buttons()[1], '次按钮应为「重试」').toBe('重试')
        // R3：不确定原因时必须用「可能」，不得断言密码已被改
        expect(text).toMatch(/可能|如需|如果/)
        // R1：不暴露错误码
        expect(text).not.toMatch(/10022|10041/)
    })

    it('回归护栏（已绿）：失败态「重新登录」始终可前进（点击即回登录页）', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, makeJwt(nowSeconds() + 3600))
        mountCheckIn(async () => conflictError())
        await flushPromises()

        expect(mocks.replace, '10022 不得自动跳登录页（T558 R1）').not.toHaveBeenCalled()
        clickButton('重新登录')
        await flushPromises()
        expect(mocks.replace).toHaveBeenCalledWith('/auth/signin')
    })
})

describe('AC7：10022 + token 已过期 ⇒ 过期语义；短时并发 ⇒ 重试为主', () => {
    it('token 已过期 ⇒ 文案含「过期」，不得说「密码被改」', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, makeJwt(nowSeconds() - 3600))
        mountCheckIn(async () => conflictError())
        await flushPromises()

        const text = bodyText()
        expect(text, `token 已过期时应走过期语义；实测：${text}`).toMatch(/过期/)
        expect(text, '已过期场景不得断言「密码被改 / 其它设备」').not.toMatch(
            /密码|其它设备|其他设备/
        )
        expect(text).not.toMatch(/10022|10041/)
    })

    it('短时并发检入（连续两次 10022）⇒ 第二次以「重试」为主，不再断言密码被改', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, makeJwt(nowSeconds() + 3600))
        const checkIn = vi.fn(async () => conflictError())
        mountCheckIn(checkIn)
        await flushPromises()
        expect(buttons()[0], '前置：首次冲突以「重新登录」为主').toBe('重新登录')

        // 用户点「重试」⇒ 短时间内再次 10022 ⇒ 更像并发检入而非改密
        clickButton('重试')
        await flushPromises()

        expect(checkIn, '「重试」必须真的再次发起检入').toHaveBeenCalledTimes(2)
        expect(buttons()[0], `并发冲突应以「重试」为主；实测顺序：${buttons().join(' / ')}`).toBe(
            '重试'
        )
        expect(bodyText(), '并发冲突不得断言「密码被改」').not.toMatch(/密码/)
    })
})

describe('回归护栏（已绿）：10022 的非目标分支不变', () => {
    it('10022 不弹凭证错误、不自动跳转、无永久 loading', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, makeJwt(nowSeconds() + 3600))
        mountCheckIn(async () => conflictError())
        await flushPromises()

        expect(mocks.messageError, '10022 不是凭证错误 ⇒ 不弹 error').not.toHaveBeenCalled()
        expect(mocks.replace, '10022 不自动跳登录页').not.toHaveBeenCalled()
        expect(buttons().length, '失败终态必须有可前进动作（非永久 loading）').toBeGreaterThan(0)
    })
})