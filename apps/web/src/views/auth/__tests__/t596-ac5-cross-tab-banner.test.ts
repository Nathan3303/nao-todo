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
import { installSessionEnd } from '@/session-end'
import {
    installSignOutBroadcastListener,
    isSignOutBroadcastMessage,
    resetSignOutBroadcastForTest,
    setSignOutBroadcastChannelForTest,
    type SignOutBroadcastChannel
} from '@/views/auth/sign-out-broadcast'

/**
 * T596 红基线 —— AC5：跨标签同步「回登录页 + 同一横幅」，且**无回环**
 *
 * 链路（只走既有公开缝）：
 *  - 发送方 `A`：真实单点 `installSessionEnd` + 真实 `fireAuthExpiry`（载体 = 现有
 *    `sign-out-broadcast.ts` 频道；测试用 `setSignOutBroadcastChannelForTest` 注入**不自动回投**的
 *    假频道 —— 与真实 `BroadcastChannel` 语义一致：发送者收不到自己发的消息）；
 *  - 接收方 `B`：`installSignOutBroadcastListener(routerB)` 收到 A 的**同一条**消息 ⇒
 *    `replace('/auth/signin')` **恰 1 次**、`sessionStorage` 得到同一类别、登录页显示**同一横幅**、
 *    且**不得再次广播**（否则 A/B 互投 = 回环）。
 *
 * 不假设消息字段名（`reason` / `category` …）：直接把 A 产出的消息原样喂给 B。
 *
 * 口径说明（PRD §S5 的「登出」按「失效」读）：主动登出**不给**横幅（R3 不误导：用户自己点的）；
 * 本用例覆盖**失效**广播（有类别可同步）。若 PM 要求主动登出也显示横幅，请回执前告知 ⇒ 用例调整。
 *
 * 状态：**红**（`session-end` 不发广播；接收侧不落类别；横幅未实现）。
 * 变异易感：接收侧再广播一次 ⇒ 无回环断言红；接收侧导航两次 ⇒ 导航计数红。
 */

const { default: AuthSignIn } =
    await import('@nao-todo/presentation-identity/src/components/sign-in.vue')

const BANNER = '[data-testid="session-end-banner"]'

const nowSeconds = (): number => Math.floor(Date.now() / 1000)

const makeJwt = (expSeconds: number): string => {
    const payload = { Id: '422644611870101504', exp: expSeconds, iss: 'NaoTodoServer' }
    const encoded = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encoded}.sig`
}

/** 不自动回投的假频道（等价真实 `BroadcastChannel`：发送者收不到自己的消息） */
type FakeChannel = SignOutBroadcastChannel & {
    posted: unknown[]
    dispatch: (data: unknown) => void
}

const makeFakeChannel = (): FakeChannel => {
    const listeners: ((event: MessageEvent) => void)[] = []
    const channel = {
        posted: [] as unknown[],
        postMessage(message: unknown) {
            channel.posted.push(message)
        },
        addEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
            listeners.push(listener)
        },
        removeEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
            const index = listeners.indexOf(listener)
            if (index >= 0) listeners.splice(index, 1)
        },
        close() {},
        dispatch(data: unknown) {
            for (const listener of listeners.slice()) listener({ data } as MessageEvent)
        }
    }
    return channel
}

type FakeRouter = {
    resolve: (target: string) => { matched: unknown[]; fullPath: string }
    replace: ReturnType<typeof vi.fn>
}

const makeFakeRouter = (): FakeRouter => ({
    resolve: () => ({ matched: [{}], fullPath: '/auth/signin' }),
    replace: vi.fn(async () => undefined)
})

let channel: FakeChannel
let routerA: FakeRouter
let routerB: FakeRouter
let router: Router
let wrapper: VueWrapper | null = null

const mountSignIn = async (): Promise<void> => {
    router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/auth/signin', name: 'signin', component: { template: '<div />' } },
            { path: '/auth/signup', name: 'signup', component: { template: '<div />' } }
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

const signinNavigations = (fake: FakeRouter): number =>
    fake.replace.mock.calls.filter((args) => args[0] === '/auth/signin').length

beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
    resetAuthExpiryForTest()
    resetSignOutBroadcastForTest()
    channel = makeFakeChannel()
    setSignOutBroadcastChannelForTest(channel)
    routerA = makeFakeRouter()
    routerB = makeFakeRouter()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    resetAuthExpiryForTest()
    resetSignOutBroadcastForTest()
    vi.restoreAllMocks()
})

describe('AC5：跨标签会话结束（回登录页 + 同一横幅 + 无回环）', () => {
    it('标签 A 失效 ⇒ 广播**恰 1 条**合法消息（不自我回投）', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, makeJwt(nowSeconds() - 3600))
        installSessionEnd(routerA as never)

        fireAuthExpiry('credential-invalid')
        await flushPromises()

        expect(
            channel.posted.length,
            `标签 A 失效应广播恰 1 条消息；实测：${JSON.stringify(channel.posted)}`
        ).toBe(1)
        expect(
            isSignOutBroadcastMessage(channel.posted[0]),
            `广播消息必须是既有 sign-out 消息形态；实测：${JSON.stringify(channel.posted[0])}`
        ).toBe(true)
        expect(signinNavigations(routerA), '标签 A 自身只导航 1 次').toBe(1)
    })

    it('标签 B 收到 A 的同一消息 ⇒ 回登录页 1 次、显示同一横幅、不再回广播', async () => {
        // A：产生消息（与上一条同一路径）
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, makeJwt(nowSeconds() - 3600))
        installSessionEnd(routerA as never)
        fireAuthExpiry('credential-invalid')
        await flushPromises()
        const message = channel.posted[0]

        // B：只安装接收侧（A 的 router 与 B 的 router 相互独立）
        installSignOutBroadcastListener(routerB as never)
        channel.dispatch(message)
        await flushPromises()

        expect(signinNavigations(routerB), '标签 B 应回登录页且**恰 1 次**（无回环）').toBe(1)
        expect(channel.posted.length, 'B 收到后不得再次广播（否则 A/B 互投 = 回环）').toBe(1)

        await mountSignIn()
        const banner = document.querySelector<HTMLElement>(BANNER)
        expect(banner, '标签 B 的登录页应显示同一横幅').not.toBeNull()
        expect(
            banner?.textContent ?? '',
            `B 的横幅应与 A 同一语义（A 的 token 已过期）；实测：${banner?.textContent ?? ''}`
        ).toMatch(/过期/)
    })

    it('AC5 重复投递同一消息不得造成回环广播（postMessage 恒 1）', async () => {
        localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, makeJwt(nowSeconds() + 3600))
        installSessionEnd(routerA as never)
        fireAuthExpiry('credential-invalid')
        await flushPromises()
        const message = channel.posted[0]

        installSignOutBroadcastListener(routerB as never)
        channel.dispatch(message)
        await flushPromises()
        channel.dispatch(message)
        await flushPromises()

        expect(channel.posted.length, '接收侧永不回广播（回环判据）').toBe(1)
        expect(
            signinNavigations(routerB),
            'B 每条消息只导航 1 次（2 条消息 ⇒ 2 次，不得指数放大）'
        ).toBeLessThanOrEqual(2)
    })
})