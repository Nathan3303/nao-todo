// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'
import {
    NueButton,
    NueCollapse,
    NueCollapseItem,
    NueDiv,
    NueIcon,
    NueLink,
    NueText,
    NueTooltip
} from 'nue-ui'
import { NaoSmartList } from '../index'
import ProjectSmartList from '../../../../presentation/project/components/smart-list/smart-list.vue'
import TagSmartList from '../../../../presentation/tag/components/smart-list/smart-list.vue'

/**
 * T603 红基线 —— AC2：`smart-list` 动态面（`DEF-116` 边界）
 *
 * 现状：`smart-list.vue` 用 `<nue-link :route="link.route">` ⇒ 用户自建清单 / 标签
 * **全部**渲染成无 `href` 的 `<a>`（数量随用户数据增长，不是固定 2 条）。
 *
 * 该面必须**数据驱动**断言：0 条 / 1 条 / 多条三档；`ProjectSmartList` / `TagSmartList`
 * 两处包装（真实商品组件）都要覆盖。样式只断言主题类名（R5 结构证据）。
 *
 * 状态：**红**（1 条 / 多条两档无 href）。
 */

const stub = { template: '<div />' }

const buildRouter = () =>
    createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/tasks/p/:projectId', name: 'tasks-project', component: stub },
            { path: '/tasks/t/:tagId', name: 'tasks-tag', component: stub }
        ]
    })

const projectLink = (index: number) => ({
    id: `project-${index}`,
    title: `自建清单 ${index}`,
    icon: 'more2',
    route: { name: 'tasks-project', params: { projectId: `project-${index}` } }
})

const tagLink = (index: number) => ({
    id: `tag-${index}`,
    title: `自建标签 ${index}`,
    icon: 'tag',
    route: { name: 'tasks-tag', params: { tagId: `tag-${index}` } },
    payload: { color: 'red' }
})

const globalOptions = {
    components: {
        NueButton,
        NueCollapse,
        NueCollapseItem,
        NueDiv,
        NueIcon,
        NueLink,
        NueText,
        NueTooltip
    }
}

let wrappers: VueWrapper[] = []

const track = (wrapper: VueWrapper): VueWrapper => {
    wrappers.push(wrapper)
    return wrapper
}

const anchors = (wrapper: VueWrapper): HTMLAnchorElement[] =>
    wrapper.findAll('a').map((a) => a.element as HTMLAnchorElement)

const hrefs = (wrapper: VueWrapper): string[] =>
    anchors(wrapper)
        .map((a) => a.getAttribute('href'))
        .filter((href): href is string => typeof href === 'string' && href.length > 0)

const describeAnchors = (wrapper: VueWrapper) =>
    anchors(wrapper).map((a) => ({
        href: a.getAttribute('href'),
        text: (a.textContent ?? '').trim(),
        class: a.className
    }))

const mountSmartList = (links: unknown[]) => {
    const router = buildRouter()
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
        mount(Host, {
            attachTo: document.body,
            global: { plugins: [router], ...globalOptions }
        })
    )
    return { wrapper, router }
}

const mountWrapperList = (component: typeof ProjectSmartList, links: unknown[]) => {
    const router = buildRouter()
    const Host = defineComponent({
        setup: () => () =>
            h(
                NueCollapse,
                { modelValue: ['smart'], theme: 'menu' },
                { default: () => h(component as never, { links } as never) }
            )
    })
    const wrapper = track(
        mount(Host, {
            attachTo: document.body,
            global: { plugins: [router], ...globalOptions }
        })
    )
    return { wrapper, router }
}

const expectedProjectHref = (router: ReturnType<typeof buildRouter>, index: number): string => {
    const resolved = router.resolve({
        name: 'tasks-project',
        params: { projectId: `project-${index}` }
    }) as unknown as { href: string }
    return resolved.href
}

const expectedTagHref = (router: ReturnType<typeof buildRouter>, index: number): string => {
    const resolved = router.resolve({
        name: 'tasks-tag',
        params: { tagId: `tag-${index}` }
    }) as unknown as { href: string }
    return resolved.href
}

afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    wrappers = []
    document.body.innerHTML = ''
})

describe('T603 AC2 · smart-list 动态面：0 / 1 / 多条都要有 href', () => {
    it('AC2① 0 条：无锚点、显示空态（不因无数据而崩）', async () => {
        const { wrapper } = mountSmartList([])
        await flushPromises()

        expect(anchors(wrapper).length).toBe(0)
        expect(wrapper.text()).toContain('用清单来分类收集')
    })

    it('AC2② 1 条：唯一链接有 href = router.resolve(route).href', async () => {
        const { wrapper, router } = mountSmartList([projectLink(1)])
        await flushPromises()

        expect(hrefs(wrapper), `实测：${JSON.stringify(describeAnchors(wrapper))}`).toEqual([
            expectedProjectHref(router, 1)
        ])
        expect(anchors(wrapper)[0]!.className).toContain('nue-link--route')
    })

    it('AC2③ 多条（7 条，数据驱动）：每条链接都有 href，顺序与数据一致', async () => {
        const { wrapper, router } = mountSmartList(
            Array.from({ length: 7 }, (_, index) => projectLink(index + 1))
        )
        await flushPromises()

        const expected = Array.from({ length: 7 }, (_, index) =>
            expectedProjectHref(router, index + 1)
        )
        expect(hrefs(wrapper), `实测：${JSON.stringify(describeAnchors(wrapper))}`).toEqual(
            expected
        )
        anchors(wrapper).forEach((a) => expect(a.className).toContain('nue-link--route'))
    })

    it('AC2④ 自建清单包装（ProjectSmartList）：3 条链接全部有 href', async () => {
        const { wrapper, router } = mountWrapperList(
            ProjectSmartList,
            Array.from({ length: 3 }, (_, index) => projectLink(index + 1))
        )
        await flushPromises()

        const expected = Array.from({ length: 3 }, (_, index) =>
            expectedProjectHref(router, index + 1)
        )
        expect(hrefs(wrapper), `实测：${JSON.stringify(describeAnchors(wrapper))}`).toEqual(
            expected
        )
    })

    it('AC2⑤ 自建标签包装（TagSmartList）：3 条链接全部有 href', async () => {
        const { wrapper, router } = mountWrapperList(
            TagSmartList,
            Array.from({ length: 3 }, (_, index) => tagLink(index + 1))
        )
        await flushPromises()

        const expected = Array.from({ length: 3 }, (_, index) => expectedTagHref(router, index + 1))
        expect(hrefs(wrapper), `实测：${JSON.stringify(describeAnchors(wrapper))}`).toEqual(
            expected
        )
    })

    it('AC3 附加：动态面链接可聚焦且有可访问名（标题即名称）', async () => {
        const { wrapper } = mountSmartList(
            Array.from({ length: 3 }, (_, index) => projectLink(index + 1))
        )
        await flushPromises()

        const navAnchors = anchors(wrapper).filter((a) => a.getAttribute('href'))
        expect(navAnchors.length).toBeGreaterThan(0)
        navAnchors.forEach((a) => {
            const name = (
                a.getAttribute('aria-label') ||
                a.getAttribute('title') ||
                a.textContent ||
                ''
            ).trim()
            expect(name).not.toBe('')
            a.focus()
            expect(document.activeElement).toBe(a)
        })
    })
})