// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
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

/**
 * T589 红基线 —— AC8 深链注册（`DEF-95`，ADR D7）
 *
 * 缺陷现场：`sign-up.vue` 注册成功后 `router.push({ path: '/auth/signin' })` 丢弃 `query.redirect`；
 * 注册/登录互链 `nue-link route="/auth/signin" | "/auth/signup"` 也不带 `redirect`。
 *
 * 判据：
 * - `/auth/signup?redirect=/calendar/day` 注册成功 ⇒ 落 `/calendar/day`（不是 `/auth/signin`）；
 * - 登录页 ↔ 注册页互链（**真实 router-link href**）携带 `redirect`；
 * - 无 `redirect` ⇒ 行为不变（注册成功仍回登录页）。
 *
 * 状态：**红**（透传缺失）。
 * 变异易感：删透传 ⇒ 前两条红。
 */

vi.mock('@nao-todo/shared/components/rule-hint', () => ({
    PasswordRuleHint: defineComponent({ name: 'PasswordRuleHint', template: '<div />' })
}))

const DEEP_LINK = '/calendar/day'

const { default: AuthSignUp } =
    await import('@nao-todo/presentation-identity/src/components/sign-up.vue')
const { default: AuthSignIn } =
    await import('@nao-todo/presentation-identity/src/components/sign-in.vue')

let router: Router
let wrapper: VueWrapper | null = null

const makeRouter = (): Router =>
    createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/auth/signup', name: 'signup', component: { template: '<div />' } },
            { path: '/auth/signin', name: 'signin', component: { template: '<div />' } },
            { path: '/tasks', name: 'tasks', component: { template: '<div />' } },
            { path: DEEP_LINK, name: 'day', component: { template: '<div />' } }
        ]
    })

const mountAt = async (page: unknown, path: string): Promise<VueWrapper> => {
    await router.push(path)
    await router.isReady()
    wrapper = mount(page as never, {
        attachTo: document.body,
        // 被测页是本批 patch 对象（`authUseCase` 为注入桩），选项类型不做静态强约束
        props: {
            authUseCase: { signUp: async () => null, signIn: async () => null }
        } as never,
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
    return wrapper
}

/** 提交注册表单（`@click` 绑在 submit 按钮上，见 `sign-up.vue`） */
const submitSignUp = async (): Promise<void> => {
    const button = document.querySelector<HTMLButtonElement>('button[type="submit"]')
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    await flushPromises()
}

const anchorHrefs = (): string[] =>
    [...document.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '')

/**
 * 互链是否携带 `redirect`
 * @description 实测（nue-ui 1.13.0 + 真实 router 挂载）：`nue-link route=...` 渲染为
 *              `<a class="nue-link">` **不带 href**（`route → router-link` 分支在本版本未生效）
 *              ⇒ 以「真实组件收到的 props」为主要证据，href 若渲染则一并接受。
 */
const linkCarriesRedirect = (target: '/auth/signin' | '/auth/signup'): boolean => {
    const targets = wrapper!.findAllComponents(NueLink).map((link) => JSON.stringify(link.props()))
    const viaProps = targets.some(
        (target_) => target_.includes(target) && target_.includes('redirect')
    )
    const viaHref = anchorHrefs().some(
        (href) => href.includes(target) && href.includes('redirect=')
    )
    return viaProps || viaHref
}

beforeEach(() => {
    router = makeRouter()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('AC8：注册成功保留 query.redirect', () => {
    it('`?redirect=/calendar/day` ⇒ 注册成功落深链目标', async () => {
        await mountAt(AuthSignUp, `/auth/signup?redirect=${encodeURIComponent(DEEP_LINK)}`)

        await submitSignUp()

        expect(router.currentRoute.value.path).toBe(DEEP_LINK)
    })

    it('无 redirect ⇒ 行为不变（仍回登录页）', async () => {
        await mountAt(AuthSignUp, '/auth/signup')

        await submitSignUp()

        expect(router.currentRoute.value.path).toBe('/auth/signin')
    })
})

describe('AC8：注册 ↔ 登录互链携带 redirect', () => {
    it('注册页「去登录」链接带 redirect', async () => {
        await mountAt(AuthSignUp, `/auth/signup?redirect=${encodeURIComponent(DEEP_LINK)}`)
        expect(
            linkCarriesRedirect('/auth/signin'),
            `实际 props：${wrapper!
                .findAllComponents(NueLink)
                .map((link) => JSON.stringify(link.props()))
                .join(' | ')}｜实际 href：${anchorHrefs().join(' | ')}`
        ).toBe(true)
    })

    it('登录页「去注册」链接带 redirect', async () => {
        await mountAt(AuthSignIn, `/auth/signin?redirect=${encodeURIComponent(DEEP_LINK)}`)

        expect(
            linkCarriesRedirect('/auth/signup'),
            `实际 props：${wrapper!
                .findAllComponents(NueLink)
                .map((link) => JSON.stringify(link.props()))
                .join(' | ')}｜实际 href：${anchorHrefs().join(' | ')}`
        ).toBe(true)
    })
})