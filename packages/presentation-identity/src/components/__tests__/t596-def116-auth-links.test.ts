// @vitest-environment jsdom
/// <reference types="node" />
import { existsSync, readFileSync, readdirSync } from 'node:fs'
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
 * T596 红基线 —— AC10：`DEF-116` 认证互链「可访问名 + 可聚焦」或「核查结论落盘」
 *
 * 背景：`nue-ui` 1.13.0 的 `nue-link route="…"` 渲染 `<a class="nue-link">` **无 `href`**
 * （`T589` 实测：props 正确、DOM 缺 href）⇒ 键盘/读屏拿不到链接语义。
 *
 * 本用例按 PRD §AC10 的**二选一**写（不预设 rd-fe 方案）：
 * - **规避分支**（把互链换成原生 `router-link` / `a[href]`）⇒ 必须满足
 *   ① 有可访问名 ② 可聚焦（有 `href` 或 `tabindex >= 0`）③ `href` 指向对应认证页；
 * - **只登记不改分支**（互链仍是无 `href` 的 `nue-link`）⇒ 必须落**核查结论**：
 *   `docs/reports/**` 里有 DEF-116 报告，且含「受影响页面」清单与「规避结论」。
 *   否则缺陷既没修也没结论 ⇒ 红。
 *
 * 状态：**红**（当前 `<a class="nue-link">` 无 href、不可聚焦，且无 DEF-116 核查报告）。
 * 变异易感：删掉链接文本 ⇒ 可访问名红；把 `href` 换成死的 `/auth/xxx` ⇒ 目标断言红。
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

const isFocusable = (el: HTMLAnchorElement): boolean => {
    if (el.hasAttribute('href')) return true
    const tabindex = el.getAttribute('tabindex')
    return tabindex !== null && Number(tabindex) >= 0
}

/** `DEF-116` 核查结论是否落盘（**专门报告**，不含缺陷池登记行） */
const defectReport = (): { found: boolean; file: string; text: string } => {
    const dir = join(REPO_ROOT, 'docs/reports')
    const files = readdirSync(dir)
        .filter((name) => name.endsWith('.md'))
        // 缺陷池是登记台账（每行都只写「待核」），不是核查结论 ⇒ 必须另有专门报告
        .filter((name) => /(t596|def-?116)/i.test(name))
    for (const name of files) {
        const text = readFileSync(join(dir, name), 'utf8')
        if (/DEF-116/.test(text) && /受影响|影响页|影响面/i.test(text)) {
            return { found: true, file: name, text }
        }
    }
    return { found: false, file: '', text: '' }
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

describe.each([
    {
        page: 'signin' as const,
        route: '/auth/signin',
        target: '/auth/signup',
        label: '登录页 → 注册'
    },
    {
        page: 'signup' as const,
        route: '/auth/signup',
        target: '/auth/signin',
        label: '注册页 → 登录'
    }
])('AC10/DEF-116：$label 互链', ({ page, route, target }) => {
    it('互链有可访问名（不靠颜色/图标传达语义）', async () => {
        await mountAt(page === 'signin' ? AuthSignIn : AuthSignUp, route)

        const anchors = links()
        expect(anchors.length, '认证页互链应仍存在（零丢失）').toBeGreaterThan(0)
        for (const anchor of anchors) {
            expect(
                accessibleName(anchor),
                `互链缺少可访问名（文本 / aria-label）；DOM：${anchor.outerHTML}`
            ).not.toBe('')
        }
    })

    it('互链满足「原生 href + 可聚焦」或「DEF-116 核查结论落盘」二选一', async () => {
        await mountAt(page === 'signin' ? AuthSignIn : AuthSignUp, route)

        const anchors = links()
        expect(anchors.length).toBeGreaterThan(0)
        const nativeLinks = anchors.filter(
            (anchor) => anchor.hasAttribute('href') && isFocusable(anchor)
        )

        if (nativeLinks.length === anchors.length) {
            // 规避分支：必须真的指向对应认证页（不是空 href / '#')
            for (const anchor of nativeLinks) {
                const href = anchor.getAttribute('href') ?? ''
                expect(href, `href 不得为空 / 占位；DOM：${anchor.outerHTML}`).not.toBe('')
                expect(href, `href 不得是占位锚点；实测：${href}`).not.toBe('#')
                expect(
                    href,
                    `href 应指向 ${target}（可携带 redirect query）；实测：${href}`
                ).toContain(target)
            }
            return
        }

        // 只登记不改分支：必须给出核查结论（受影响页面清单 + 规避结论）
        const report = defectReport()
        expect(
            report.found,
            `DEF-116 未修（互链仍不可聚焦：${anchors
                .filter((anchor) => !isFocusable(anchor))
                .map((anchor) => anchor.outerHTML)
                .join(' / ')}）⇒ 必须在 docs/reports 落核查报告（含受影响页面清单 + 规避结论）`
        ).toBe(true)
        expect(report.text, `${report.file} 应给出规避结论（规避 / 替代 / 上游）`).toMatch(
            /规避|替代|上游/
        )
    })
})