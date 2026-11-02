// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type RouteLocationRaw } from 'vue-router'
import { defineComponent, h } from 'vue'
import {
    NueButton,
    NueCollapse,
    NueCollapseItem,
    NueDiv,
    NueLink,
    NueText,
    NueTooltip
} from 'nue-ui'
import { NaoSmartList } from '../index'
import type { NaoSmartListLinkVO } from '../types'

/**
 * T633 AC3 · `smart-list` 动态面（自建清单 / 标签）在任意条数下均渲染真链接
 *
 * 为什么单独成文件：既有 `smart-list.test.ts` 用 `RouterLinkStub`（`<a>` 无 `href`），
 * 只锁表头 / 行结构；AC3 要求的是**动态条数 × 真 `href`**，需要真实 router + 真实 `nue-link`。
 *
 * 覆盖 0 / 1 / 多 三种条数（`smart-list` 的条数随用户数据增长，不是固定调用点）。
 * 断言与 `t603-nav-a11y` 保持同一强度：`href` 非空且 `= router.resolve(route).href`，
 * 且 `.nue-link--route` 主题类存在（外观由类名承载）。
 */

const stub = { template: '<div />' }

const buildRouter = () =>
    createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/tasks/project/:projectId', name: 'tasks-project', component: stub },
            { path: '/tasks/tag/:tagId', name: 'tasks-tag', component: stub }
        ]
    })

const globalComponents = {
    NueButton,
    NueCollapse,
    NueCollapseItem,
    NueDiv,
    NueLink,
    NueText,
    NueTooltip
}

let wrappers: VueWrapper[] = []

const track = (wrapper: VueWrapper): VueWrapper => {
    wrappers.push(wrapper)
    return wrapper
}

afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    wrappers = []
    document.body.innerHTML = ''
})

const mountList = async (links: NaoSmartListLinkVO[]) => {
    const router = buildRouter()
    await router.push('/tasks/project/p0')
    await router.isReady()
    const Host = defineComponent({
        setup: () => () =>
            h(
                NueCollapse,
                { modelValue: ['smart'], theme: 'menu' },
                {
                    default: () =>
                        h(NaoSmartList, {
                            collapseItemName: 'smart',
                            name: '清单',
                            links
                        })
                }
            )
    })
    const wrapper = track(
        mount(Host, { global: { components: globalComponents, plugins: [router] } })
    )
    await flushPromises()
    return { wrapper, router }
}

const anchors = (wrapper: VueWrapper): HTMLAnchorElement[] =>
    wrapper.findAll('a').map((a) => a.element as HTMLAnchorElement)

const expectedHref = (router: ReturnType<typeof buildRouter>, route: RouteLocationRaw): string =>
    (router.resolve(route) as unknown as { href: string }).href

describe('T633 AC3 · smart-list 动态面条数 0 / 1 / 多', () => {
    it('0 条：不渲染任何 <a>，走空态文案（不得出现空 href 的伪链接）', async () => {
        const { wrapper } = await mountList([])
        expect(wrapper.findAll('a')).toHaveLength(0)
        const empty = wrapper.find('.nue-text--empty')
        expect(
            empty.exists(),
            `0 条时应渲染空态文案；实测 html=${wrapper.html().slice(0, 400)}`
        ).toBe(true)
        expect(empty.text()).toContain('用清单来分类收集')
    })

    it('1 条：单个自建清单渲染出真 href 且带 --route 主题类', async () => {
        const route: RouteLocationRaw = { name: 'tasks-project', params: { projectId: 'p1' } }
        const { wrapper, router } = await mountList([
            { id: 'p1', title: '自建清单一', icon: 'list', route }
        ])

        const found = anchors(wrapper)
        expect(found).toHaveLength(1)
        expect(found[0]!.getAttribute('href')).toBe(expectedHref(router, route))
        expect(found[0]!.className).toContain('nue-link--route')
        expect(found[0]!.textContent).toContain('自建清单一')
    })

    it('多条（3 条，清单 + 标签混合）：每一项 href 均等于 router.resolve(route).href 且顺序一致', async () => {
        const routes: RouteLocationRaw[] = [
            { name: 'tasks-project', params: { projectId: 'p1' } },
            { name: 'tasks-project', params: { projectId: 'p2' } },
            { name: 'tasks-tag', params: { tagId: 't1' } }
        ]
        const links: NaoSmartListLinkVO[] = routes.map((route, index) => ({
            id: `item-${index}`,
            title: `项 ${index + 1}`,
            icon: 'list',
            route
        }))

        const { wrapper, router } = await mountList(links)

        const found = anchors(wrapper)
        expect(found).toHaveLength(3)
        expect(found.map((a) => a.getAttribute('href'))).toEqual(
            routes.map((route) => expectedHref(router, route))
        )
        found.forEach((a) => {
            expect(a.getAttribute('href'), '动态面不得出现空 href').toBeTruthy()
            expect(a.className).toContain('nue-link--route')
        })
    })
})