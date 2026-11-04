// @vitest-environment jsdom
/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
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
import { defineComponent } from 'vue'

/**
 * T596 红基线 → T657（R-L）回收：认证互链恢复 `<nue-link :route>`（`DEF-116` 到期项）
 *
 * 历史：`nue-ui` 1.13.0 的 `nue-link route="…"` 渲染 `<a class="nue-link">` **无 `href`**
 * （`T589` 实测：props 正确、DOM 缺 href）⇒ 认证互链一度改原生 `<router-link class="nue-link">` 规避。
 * 上游 `nue-ui#108` 已随 **1.15.3** 修复（本仓 `v1.16.4` 升级并回退 11 处 + `smart-list`），
 * 本批（`T657`）回收最后 2 处身份页互链 ⇒ `DEF-116` 家族**全量清零**。
 *
 * 本用例锁定四条**不可放宽**的事实（真实挂载，真 `nue-link` + 真 memory router）：
 * ① **组件来源**：互链由真实 `NueLink` 渲染（`router-link` 回退会先红在这里 —— 原生 `router-link`
 *    同样产出带 `href` 的 `<a>`，只看 href / 焦点是**咬不住**的）；
 * ② **链接语义**：`<a>` + `href === router.resolve(target).href` + `tabIndex >= 0` + `focus()` 命中 +
 *    可访问名非空（键盘 Tab / 中键新标签 / 读屏链接语义）；
 * ③ **SPA 行为**：点击走 `RouterLink` 的拦截（`defaultPrevented === true`）+ 路由真的变化（不是整页跳）；
 * ④ **外观不变**：`<a>` 类名仍是 `nue-link`（行内文字链），不带 `nue-link--route`
 *    （后者是 `display:flex; height:var(--nue-box-size-md)` 的导航按钮形态，会把句子拆开）；
 *    焦点环由 `apps/web/src/themes/link.css` 的 `.nue-link:focus-visible` 单点提供，组件内不自写。
 *
 * 源码级断言（⑤）额外咬住「规避残留」：两个组件文件不得再出现 `router-link` / `auth-link` /
 * 「DEF-116 规避」注释 —— 否则上游修复后回退的事实会被静默丢失。
 *
 * 变异易感：删掉链接文本 ⇒ 可访问名红；把 `route` 换成死的 `href="/auth/xxx"` ⇒ SPA 断言红；
 * 改回 `<router-link class="nue-link auth-link">` ⇒ ①⑤ 红。
 */

const { default: AuthSignIn } =
    await import('@nao-todo/presentation-identity/src/components/sign-in.vue')

vi.mock('@nao-todo/shared/components/rule-hint', () => ({
    PasswordRuleHint: defineComponent({ name: 'PasswordRuleHint', template: '<div />' })
}))
const { default: AuthSignUp } =
    await import('@nao-todo/presentation-identity/src/components/sign-up.vue')

const REPO_ROOT = (() => {
    let dir = dirname(new URL(import.meta.url).pathname)
    for (let i = 0; i < 8; i += 1) {
        if (existsSync(join(dir, 'apps/web/src')) && existsSync(join(dir, 'docs'))) return dir
        dir = dirname(dir)
    }
    throw new Error('无法定位仓库根')
})()

let router: Router
let wrapper: VueWrapper | null = null

const makeRouter = (): Router =>
    createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/auth/signin', name: 'signin', component: { template: '<div />' } },
            { path: '/auth/signup', name: 'signup', component: { template: '<div />' } }
        ]
    })

const mountAt = async (page: unknown, path: string): Promise<void> => {
    await router.push(path)
    await router.isReady()
    wrapper = mount(page as never, {
        attachTo: document.body,
        props: {
            authUseCase: { signIn: async () => null, signUp: async () => null }
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
}

const links = (): HTMLAnchorElement[] => [...document.querySelectorAll<HTMLAnchorElement>('a')]

const accessibleName = (el: Element): string =>
    (el.getAttribute('aria-label') ?? el.textContent ?? '').trim()

/** 组件源码（源码级断言用：`DEF-116` 规避残留不得复活） */
const sourceOf = (file: string): string =>
    readFileSync(join(REPO_ROOT, 'packages/presentation-identity/src/components', file), 'utf8')

beforeEach(() => {
    router = makeRouter()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe.each([
    {
        page: 'signin' as const,
        file: 'sign-in.vue',
        route: '/auth/signin',
        target: '/auth/signup',
        label: '登录页 → 注册'
    },
    {
        page: 'signup' as const,
        file: 'sign-up.vue',
        route: '/auth/signup',
        target: '/auth/signin',
        label: '注册页 → 登录'
    }
])('R-L/DEF-116 回收：$label 互链', ({ page, file, route, target }) => {
    it('① 互链由真实 `NueLink` 渲染（不是原生 router-link / 裸 a）', async () => {
        await mountAt(page === 'signin' ? AuthSignIn : AuthSignUp, route)

        const anchors = links()
        expect(anchors.length, '认证页互链应仍存在（零丢失）').toBe(1)

        const linkWrapper = wrapper!.findComponent({ name: 'NueLink' })
        expect(
            linkWrapper.exists(),
            `互链必须由真实 nue-link 渲染（否则 DEF-116 规避残留）；DOM：${anchors[0]!.outerHTML}`
        ).toBe(true)
        expect(linkWrapper.element, 'nue-link 的根元素应就是该互链 <a>').toBe(anchors[0])
        expect(anchors[0]!.tagName, '互链应为 <a>（链接语义）').toBe('A')
    })

    it('② 链接语义：href 指向对应认证页 + 可聚焦 + 可访问名非空', async () => {
        await mountAt(page === 'signin' ? AuthSignIn : AuthSignUp, route)

        const anchors = links()
        expect(anchors.length).toBeGreaterThan(0)
        const expectedHref = router.resolve(target).href

        for (const anchor of anchors) {
            const href = anchor.getAttribute('href') ?? ''
            expect(href, `href 不得为空 / 占位；DOM：${anchor.outerHTML}`).not.toBe('')
            expect(href, `href 不得是占位锚点；实测：${href}`).not.toBe('#')
            expect(href, `href 应等于 router.resolve('${target}').href；实测：${href}`).toBe(
                expectedHref
            )
            expect(
                accessibleName(anchor),
                `互链缺少可访问名（文本 / aria-label）；DOM：${anchor.outerHTML}`
            ).not.toBe('')
            expect(
                (anchor as HTMLElement).tabIndex,
                `互链应可 Tab 到（tabIndex >= 0）；DOM：${anchor.outerHTML}`
            ).toBeGreaterThanOrEqual(0)

            anchor.focus()
            expect(
                document.activeElement === anchor,
                `focus() 后未命中互链；DOM：${anchor.outerHTML}`
            ).toBe(true)
        }
    })

    it('③ 点击走 SPA 导航（defaultPrevented + 路由变化，不整页跳转）', async () => {
        await mountAt(page === 'signin' ? AuthSignIn : AuthSignUp, route)

        const anchor = links()[0]!
        const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
        anchor.dispatchEvent(event)
        await flushPromises()

        expect(event.defaultPrevented, '点击应由 RouterLink 拦截（整页跳转会丢 SPA）').toBe(true)
        expect(
            router.currentRoute.value.path,
            `点击后路由应变为 ${target}；实测：${router.currentRoute.value.path}`
        ).toBe(target)
    })

    it('④ 外观不变：行内文字链（`nue-link` + `nue-link__content`，不带 `nue-link--route`）', async () => {
        await mountAt(page === 'signin' ? AuthSignIn : AuthSignUp, route)

        const anchor = links()[0]!
        expect(
            [...anchor.classList],
            `互链类名应与规避前同构（仅 nue-link）；DOM：${anchor.outerHTML}`
        ).toEqual(['nue-link'])
        expect(
            anchor.querySelector('.nue-link__content'),
            `nue-link 的内容节点缺失（主题样式会失效）；DOM：${anchor.outerHTML}`
        ).not.toBe(null)
    })

    it('⑤ 源码无 `DEF-116` 规避残留（router-link / auth-link / 过时注释）', () => {
        const source = sourceOf(file)

        expect(source, `${file} 不得再出现原生 router-link 规避`).not.toMatch(/router-link/)
        expect(source, `${file} 不得再出现 auth-link 局部样式 / 类名`).not.toMatch(/auth-link/)
        expect(source, `${file} 不得再保留「DEF-116 规避」过时注释（缺陷已闭环）`).not.toMatch(
            /DEF-116/
        )
    })
})