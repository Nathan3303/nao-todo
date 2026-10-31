// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { NueButton, NueContainer, NueDiv, NueMain, NueText } from 'nue-ui'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { t } from '@nao-todo/shared/locales'
import CheckIn from '../check-in.vue'

/**
 * T596 红基线 —— AC6 / AC7：检入冲突 `10022` 的分类与主次动作（`DEF-119`）
 *
 * 缺陷现场（用户 2026-10-31 真机）：Web 改密 ⇒ 服务端撤销其它设备会话（SEC-03）⇒ 桌面刷新
 * 检入得 `10022` ⇒ 一律显示「验证未完成，请重试」：不说明原因、默认动作（重试）无效。
 *
 * 判据（**T600 按 PM 2026-10-31 裁定改口径**，旧 T596 断言锁的是被判定为错误的语义）：
 * - AC6：`10022` + token **未过期** ⇒ 文案含「密码」/「其他设备」语义；**主按钮 = 重新登录**，
 *   次按钮 = 重试（DOM 顺序即用户看到的主次；`PROPS` 视觉主按钮由 rd-fe 用既有 token 保证，AC11）。
 * - AC7（`F4` 修正后）：`10022` + token **已过期** ⇒ 过期语义（含「过期」，**不得**说「密码被改」）；
 *   **主按钮恒为「重新登录」**（四种 `10022` 分支一致，**不随冲突次数降级**；
 *   旧口径「并发 ⇒ 重试为主」已由 PM 判定为错误语义）；
 *   **并发（≤3s 内第 2+ 次）只换文案**（`auth.checkIn.conflictConcurrent`）⇒ 主次不变、次按钮仍是「重试」；
 *   **>3s 再冲突 ⇒ 回到「密码可能已改」文案**（窗口宽度本身也是判据，锁住 3s）。
 *   依据：用例层已自动重试一次（token 已变即放弃）⇒ 走到页面的 `10022` 已吸收真并发；
 *   用户读文案后手动再试仍失败 ⇒ 反而**提高**「非并发」置信度。
 * - 通用：不暴露错误码（`10022`/`10041`）与内部键名（R1）；`10022` 不跳登录页（T558 R1 不回归）。
 *
 * 强度（相对 T596 旧断言，**未降**）：旧断言只查「第 2 次 `buttons()[0] === '重试'`」；
 * 现断言 ① 四种分支的**主/次两个位置**；② 并发分支断言**文案键**（不是 `/密码/` 的宽松否定）+ 次按钮；
 * ③ 新增「>3s 回到密码文案」⇒ 把「窗口 = 3s」也锁住（旧断言完全不管窗口宽度）。
 *
 * 变异易感：改回单一文案 ⇒ AC7 红；对调主次按钮 ⇒ AC7 四种分支全红；窗口改回 60s ⇒ 跨窗口用例红。
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

describe('AC7（T599/F4）：四种 10022 分支 ⇒ 主按钮恒「重新登录」', () => {
    const SIGN_IN = (): string => t('gate.signInAgain')
    const RETRY = (): string => t('common.retry')

    it('分支①：token 已过期 ⇒ 过期文案（不含「密码」）+ 主「重新登录」/ 次「重试」', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, makeJwt(nowSeconds() - 3600))
        mountCheckIn(async () => conflictError())
        await flushPromises()

        const text = bodyText()
        expect(text, `token 已过期时应走过期语义；实测：${text}`).toContain(
            t('auth.checkIn.conflictExpired')
        )
        expect(text, '已过期场景不得断言「密码被改 / 其他设备」').not.toMatch(
            /密码|其它设备|其他设备/
        )
        expect(text).not.toMatch(/10022|10041/)
        expect(buttons(), `主次要恒定；实测顺序：${buttons().join(' / ')}`).toEqual([
            SIGN_IN(),
            RETRY()
        ])
    })

    it('分支②：token 未过期 + 首次 ⇒「密码可能已改」文案 + 主「重新登录」/ 次「重试」', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, makeJwt(nowSeconds() + 3600))
        mountCheckIn(async () => conflictError())
        await flushPromises()

        expect(bodyText()).toContain(t('auth.checkIn.conflictRevoked'))
        expect(buttons(), `实测顺序：${buttons().join(' / ')}`).toEqual([SIGN_IN(), RETRY()])
    })

    it('分支③：token 未过期 + ≤3s 第 2 次 ⇒ 只换文案（并发），主「重新登录」/ 次「重试」', async () => {
        const base = Date.now()
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(base)
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, makeJwt(Math.floor(base / 1000) + 3600))
        const checkIn = vi.fn(async () => conflictError())
        mountCheckIn(checkIn)
        await flushPromises()
        expect(buttons()[0], '前置：首次冲突以「重新登录」为主').toBe(SIGN_IN())
        expect(bodyText(), '前置：首次为「密码可能已改」文案').toContain(
            t('auth.checkIn.conflictRevoked')
        )

        // 3s 内再失败（用户点「重试」/ 双击 / 快速刷新）⇒ 并发文案
        nowSpy.mockReturnValue(base + 2000)
        clickButton(RETRY())
        await flushPromises()

        expect(checkIn, '「重试」必须真的再次发起检入').toHaveBeenCalledTimes(2)
        expect(bodyText(), '并发分支只换文案：应为并发文案键').toContain(
            t('auth.checkIn.conflictConcurrent')
        )
        expect(bodyText(), '并发分支不得再出现「密码」断言').not.toMatch(/密码/)
        expect(buttons(), `并发分支只换文案、主次不变；实测顺序：${buttons().join(' / ')}`).toEqual(
            [SIGN_IN(), RETRY()]
        )
        expect(buttons()[1], '次按钮必须仍是「重试」（只换文案 ≠ 换主次）').toBe(RETRY())
    })

    it('分支④：token 不可解析 ⇒ 不猜原因（通用文案）+ 主「重新登录」/ 次「重试」', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, 'not-a-jwt')
        mountCheckIn(async () => conflictError())
        await flushPromises()

        expect(bodyText(), '不可判定时不得猜原因').toContain(t('auth.checkIn.conflict'))
        expect(bodyText()).not.toMatch(/密码/)
        expect(buttons(), `实测顺序：${buttons().join(' / ')}`).toEqual([SIGN_IN(), RETRY()])
    })

    it('窗口宽度：>3s 后再冲突 ⇒ 回到「密码可能已改」（并发窗口不得放宽到 60s）', async () => {
        const base = Date.now()
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(base)
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, makeJwt(Math.floor(base / 1000) + 3600))
        const checkIn = vi.fn(async () => conflictError())
        mountCheckIn(checkIn)
        await flushPromises()
        expect(buttons()[0], '前置：首次以「重新登录」为主').toBe(SIGN_IN())

        // 用户读完文案、过 4s 才再点「重试」⇒ 不构成并发证据（3s 窗口外）
        nowSpy.mockReturnValue(base + 4000)
        clickButton(RETRY())
        await flushPromises()

        expect(checkIn).toHaveBeenCalledTimes(2)
        expect(
            bodyText(),
            '超过并发窗口 ⇒ 必须回到「密码可能已改」文案（旧 60s 窗口会仍显示并发 ⇒ 本断言红）'
        ).toContain(t('auth.checkIn.conflictRevoked'))
        expect(buttons(), `跨窗口后主次仍恒定；实测：${buttons().join(' / ')}`).toEqual([
            SIGN_IN(),
            RETRY()
        ])
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