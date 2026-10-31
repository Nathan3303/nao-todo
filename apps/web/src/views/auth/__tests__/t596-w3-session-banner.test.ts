// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import {
    NueButton,
    NueContainer,
    NueContent,
    NueDiv,
    NueFooter,
    NueHeader,
    NueInput,
    NueLink,
    NueMain,
    NueText
} from 'nue-ui'
import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'
import { fireAuthExpiry, resetAuthExpiryForTest } from '@nao-todo/shared/requester/auth-expiry'
import { handleSessionEnd, installSessionEnd } from '@/session-end'
import {
    readSessionEndCategory,
    readVisibleSessionEndCategory
} from '@nao-todo/shared/requester/session-end-reason'

/**
 * T596 红基线 —— AC1–AC4 / R1 / R5：会话结束原因 ⇒ 登录页顶部横幅（`DEF-92`，ADR D5）
 *
 * 用例只依赖**既有公开缝**（不假设 rd-fe 内部模块名）：
 * - 写入：真实单点 `apps/web/src/session-end.ts`（真 `installSessionEnd` + 真 `fireAuthExpiry`），
 *   类别由 D1/`exp` 本地推断 ⇒ 契约 = `fireAuthExpiry('credential-invalid')`（**真实发布方当前
 *   发送的占位值**，见 `packages/shared/requester/index.ts:45`、`AppRoot.vue:80/92`）；
 * - 观察：**真实挂载** `sign-in.vue`（web + desktop 共用登录页组件；桌面同属本批范围 ⇒ 横幅
 *   必须在共用登录页组件里，不能只挂在 web-only 的 `entry.vue`），断言 DOM 实测值。
 *
 * 新增契约（rd-fe 实现时请对齐；如需改名请同步本文件）：
 * 1. 横幅根节点带 `data-testid="session-end-banner"`（同时用于断言与后续视觉走查定位）；
 * 2. 关闭控件是横幅内 `button`（或 `[role="button"]`），**必须可访问**（文本或 `aria-label`）；
 * 3. reason 落 `sessionStorage`，值只含**类别枚举**（`expired` / `signed-in-elsewhere` /
 *    `credential-invalid` 之类），不得含 JWT / 密码（R5）；
 * 4. reason 缺失 / 脏值 ⇒ 横幅仍出现但用**通用**一句（不空白、不断言「过期」「他处登录」）。
 *
 * 文案断言**按语义关键词**（`过期` / `其它设备|其他设备`），不钉整句：PRD §九「文案定稿以本 PRD +
 * 提交内 zh/en 为准，用户可在发版后视觉走查提出改词」⇒ 钉整句会在合理改词时误报。
 *
 * 状态：**红**（reason 推断 + 存储 + 横幅均未实现）。
 * 变异易感：删「过期」分支 ⇒ AC1 红；写死单一类别 ⇒ AC2 红；横幅去 data-testid ⇒ 全红；
 *          删关闭控件 ⇒ AC4 红；把 reason 换成 JWT ⇒ R5 红。
 */

const { default: AuthSignIn } =
    await import('@nao-todo/presentation-identity/src/components/sign-in.vue')

const BANNER = '[data-testid="session-end-banner"]'

const nowSeconds = (): number => Math.floor(Date.now() / 1000)

/** 造 JWT（只关心 payload 的 `exp`；签名不参与本地推断） */
const makeJwt = (expSeconds: number): string => {
    const payload = {
        Id: '422644611870101504',
        Payload: 'lee1928@outlook.com',
        iss: 'NaoTodoServer',
        sub: 'Token',
        exp: expSeconds
    }
    const encoded = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encoded}.sig`
}

const EXPIRED_TOKEN = makeJwt(nowSeconds() - 3600)
const FRESH_TOKEN = makeJwt(nowSeconds() + 3600)

type FakeRouter = {
    resolve: (target: string) => { matched: unknown[]; fullPath: string }
    replace: ReturnType<typeof vi.fn>
}

const makeFakeRouter = (): FakeRouter => ({
    resolve: () => ({ matched: [{}], fullPath: '/auth/signin' }),
    replace: vi.fn(async () => undefined)
})

let fakeRouter: FakeRouter
let router: Router
let wrapper: VueWrapper | null = null

const mountSignIn = async (): Promise<void> => {
    router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/auth/signin', name: 'signin', component: { template: '<div />' } },
            { path: '/auth/signup', name: 'signup', component: { template: '<div />' } },
            { path: '/tasks', name: 'tasks', component: { template: '<div />' } }
        ]
    })
    await router.push('/auth/signin')
    await router.isReady()
    wrapper = mount(AuthSignIn as never, {
        attachTo: document.body,
        props: { authUseCase: { signIn: async () => null } } as never,
        global: {
            plugins: [router],
            components: {
                'nue-container': NueContainer,
                'nue-header': NueHeader,
                'nue-main': NueMain,
                'nue-content': NueContent,
                'nue-footer': NueFooter,
                'nue-div': NueDiv,
                'nue-text': NueText,
                'nue-input': NueInput,
                'nue-button': NueButton,
                'nue-link': NueLink
            }
        }
    })
    await flushPromises()
}

/** 模拟「刷新」：卸载后重新挂载（组件内存态清空，只剩 sessionStorage） */
const remountSignIn = async (): Promise<void> => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    await mountSignIn()
}

const bannerEl = (): HTMLElement | null => document.querySelector<HTMLElement>(BANNER)
const bannerText = (): string => bannerEl()?.textContent ?? ''
const bodyText = (): string => document.body.textContent ?? ''

/** 走真实发布方路径：装单点 → 发布一次失效 */
const fireSessionEnd = async (reason: unknown): Promise<void> => {
    installSessionEnd(fakeRouter as never)
    fireAuthExpiry(reason as never)
    await flushPromises()
}

const sessionStorageValues = (): string[] => {
    const values: string[] = []
    for (let i = 0; i < sessionStorage.length; i += 1) {
        const key = sessionStorage.key(i)
        if (key) values.push(sessionStorage.getItem(key) ?? '')
    }
    return values
}

const accessibleName = (el: Element | null): string =>
    (el?.getAttribute('aria-label') ?? el?.textContent ?? '').trim()

beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
    resetAuthExpiryForTest()
    fakeRouter = makeFakeRouter()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    resetAuthExpiryForTest()
    vi.restoreAllMocks()
})

describe('AC1/AC2/AC3：失效类别本地推断（D5）⇒ 登录页横幅', () => {
    it('AC1 JWT `exp` 已过 ⇒ reason=expired ⇒ 横幅写「过期」', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, EXPIRED_TOKEN)

        await fireSessionEnd('credential-invalid')
        await mountSignIn()

        expect(
            bannerEl(),
            '期望登录页出现会话结束横幅（data-testid="session-end-banner"）'
        ).not.toBeNull()
        expect(bannerText(), `横幅文案应含「过期」；实测：${bannerText()}`).toMatch(/过期/)
        // 过期场景不得断言「他处登录」（R3 不误导）
        expect(bannerText()).not.toMatch(/其它设备|其他设备/)
        expect(
            sessionStorageValues().some((value) => /expired/.test(value)),
            `reason 应以类别枚举落 sessionStorage；实测：${JSON.stringify(sessionStorageValues())}`
        ).toBe(true)
    })

    it('AC2 JWT 未过期但服务端判凭证失效（10041/10042）⇒ 横幅写「他处登录」', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, FRESH_TOKEN)

        await fireSessionEnd('credential-invalid')
        await mountSignIn()

        expect(bannerEl(), '期望登录页出现会话结束横幅').not.toBeNull()
        expect(
            bannerText(),
            `横幅文案应含「其它设备 / 其他设备」语义；实测：${bannerText()}`
        ).toMatch(/其它设备|其他设备/)
        expect(bannerText(), '未过期场景不得断言「过期」').not.toMatch(/过期/)
        expect(
            sessionStorageValues().some((value) => /signed-in-elsewhere/.test(value)),
            `reason 应为 signed-in-elsewhere；实测：${JSON.stringify(sessionStorageValues())}`
        ).toBe(true)
    })

    it('AC3 reason 缺失 ⇒ 通用兜底（不空白、不乱断言）', async () => {
        // 无 token、无 reason（例如启动早期/装配异常时的保守路径）
        await handleSessionEnd()
        await flushPromises()
        await mountSignIn()

        expect(bannerEl(), 'reason 缺失时仍须给通用一句（不得空白静默）').not.toBeNull()
        expect(bannerText().trim().length, '通用兜底文案不得为空').toBeGreaterThan(0)
        expect(bannerText(), '通用兜底不得断言「过期」').not.toMatch(/过期/)
        expect(bannerText(), '通用兜底不得断言「他处登录」').not.toMatch(/其它设备|其他设备/)
        expect(bannerText()).toMatch(/登录/)
    })

    it('AC3 reason 脏值 ⇒ 同样是通用兜底（不被脏值带偏）', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, FRESH_TOKEN)

        await fireSessionEnd('stale-unknown-reason')
        await mountSignIn()

        expect(bannerEl(), '脏 reason 时仍须给通用一句').not.toBeNull()
        expect(bannerText().trim().length).toBeGreaterThan(0)
        expect(bannerText(), '脏值不得被当作「过期」断言').not.toMatch(/过期/)
        expect(bannerText(), '脏值不得被当作「他处登录」断言').not.toMatch(/其它设备|其他设备/)
    })
})

describe('AC4：横幅可关闭、不复发、刷新仍可读、不阻断表单', () => {
    const expiredSession = async (): Promise<void> => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, EXPIRED_TOKEN)
        await fireSessionEnd('credential-invalid')
        await mountSignIn()
        expect(bannerEl(), '前置：横幅应已出现').not.toBeNull()
    }

    it('AC4 关闭控件可访问（文本 / aria-label）且点击后横幅消失', async () => {
        await expiredSession()

        const close = bannerEl()!.querySelector('button, [role="button"]')
        expect(close, '横幅必须有可关闭控件（button / role=button）').not.toBeNull()
        expect(accessibleName(close), '关闭控件必须有可访问名（R4 + 键盘可达）').not.toBe('')

        close!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flushPromises()

        expect(bannerEl(), '点击关闭后横幅应消失').toBeNull()
    })

    it('AC4 关闭后本次不再出现（刷新后也不复现），但 reason 仍可读', async () => {
        await expiredSession()

        bannerEl()!
            .querySelector('button, [role="button"]')!
            .dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flushPromises()
        expect(bannerEl(), '前置：关闭后应立即消失').toBeNull()

        await remountSignIn()
        expect(bannerEl(), '关闭后刷新不得复发（R4：不自动消失，但关了就关）').toBeNull()
        expect(
            sessionStorageValues().some((value) => /expired/.test(value)),
            'AC4：刷新页面 reason 仍应可读（sessionStorage 保留类别）'
        ).toBe(true)
    })

    it('AC4 刷新页面（未关闭）⇒ 横幅仍在（reason 从 sessionStorage 读，不靠组件内存）', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, EXPIRED_TOKEN)
        await fireSessionEnd('credential-invalid')

        await mountSignIn()
        expect(bannerText()).toMatch(/过期/)

        await remountSignIn()
        expect(bannerEl(), '刷新后横幅应仍在（reason 落 sessionStorage）').not.toBeNull()
        expect(bannerText()).toMatch(/过期/)
    })

    it('AC4 不阻断表单：输入可用、无模态遮罩、横幅位于表单之前（顶部）', async () => {
        await expiredSession()

        const form = document.querySelector('form')
        expect(form, '登录表单应仍在 DOM 中').not.toBeNull()
        expect(
            form!.compareDocumentPosition(bannerEl()!) & Node.DOCUMENT_POSITION_PRECEDING,
            '横幅应渲染在登录表单之前（PRD：登录页顶部横幅）'
        ).toBeTruthy()

        const inputs = [...document.querySelectorAll('input')]
        expect(inputs.length, '登录表单的输入框应仍存在').toBeGreaterThanOrEqual(2)
        for (const input of inputs) {
            expect(input.hasAttribute('disabled'), '横幅不得禁用登录输入').toBe(false)
            expect(input.getAttribute('aria-disabled')).not.toBe('true')
        }
        expect(
            document.querySelector('[role="dialog"], .nue-mask, .nue-modal, [aria-modal="true"]'),
            '横幅必须是行内提示，不得是模态/遮罩（模态已被 ADR D5 否决）'
        ).toBeNull()
    })
})

describe('R1/R5：文案说人话 + 存储不含凭据', () => {
    it('R1 横幅文案零技术键名 / 错误码', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, FRESH_TOKEN)
        await fireSessionEnd('credential-invalid')
        await mountSignIn()

        const text = bannerText()
        expect(text).not.toBe('')
        expect(text, `禁错误码；实测：${text}`).not.toMatch(/1\d{4}/)
        expect(text, `禁内部键名；实测：${text}`).not.toMatch(
            /stale|OCC|revision|archivedAt|credential-invalid|signed-in-elsewhere/i
        )
    })

    it('R5 sessionStorage 只存类别枚举，不含 JWT / 密码', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, EXPIRED_TOKEN)
        await fireSessionEnd('credential-invalid')
        await mountSignIn()

        const values = sessionStorageValues()
        expect(values.length, '应写下 reason（sessionStorage）').toBeGreaterThan(0)
        for (const value of values) {
            expect(value, '不得把 JWT 落 sessionStorage').not.toContain('eyJ')
            expect(value, '不得把 token 明文落 sessionStorage').not.toContain(EXPIRED_TOKEN)
            expect(value).not.toMatch(/Bearer/)
        }
        // 会话凭证本身仍按矩阵清除（不因新存储回退）
        expect(localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)).toBeNull()
    })
})

describe('回归护栏（已绿）：登录页在无 reason 时不显示横幅', () => {
    it('正常进入登录页（无会话结束事实）⇒ 无横幅', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, FRESH_TOKEN)

        await mountSignIn()

        expect(bannerEl(), '无失效事实时不得凭空出现横幅（R3 不误导）').toBeNull()
        expect(bodyText()).toContain('登录')
    })
})

describe('T600 / `F1`：登录成功 ⇒ 失效类别被清（重登后不再误报「已过期」）', () => {
    it('登录成功 ⇒ 类别清空、sessionStorage 零残留、重进登录页无横幅', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, EXPIRED_TOKEN)
        await fireSessionEnd('credential-invalid')
        await mountSignIn()
        expect(bannerEl(), '前置：失效后横幅应出现').not.toBeNull()
        expect(readVisibleSessionEndCategory(), '前置：类别应可读').toBe('expired')

        // 用真实提交路径（`nue-button type=submit` 的 click ⇒ `submit()`）
        const submit = [...document.querySelectorAll('button')].find(
            (b) => b.textContent?.trim() === '登录'
        )
        submit?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await flushPromises()

        expect(
            readSessionEndCategory(),
            '登录成功 = 会话重新建立 ⇒ 上一次失效类别必须清掉（否则重登后再进登录页仍报「登录已过期」）'
        ).toBeNull()
        expect(readVisibleSessionEndCategory(), '登录成功后不得再有可展示类别').toBeNull()
        expect(
            sessionStorageValues(),
            '登录成功后 sessionStorage 不得残留类别或「已关闭」标记'
        ).toEqual([])

        // 模拟「重新进入登录页」：横幅不得复发
        await remountSignIn()
        expect(bannerEl(), '重登后再进登录页不得显示上一次失效横幅').toBeNull()
    })
})