// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, ref } from 'vue'
import { nueUI } from '@/nue-ui-register'
import { APP_CONTEXT_KEY } from '@/context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'
import { TASKS_VIEW_CONTEXT_KEY } from '@/views/index/tasks/context'
import { useUserStore } from '@nao-todo/presentation-identity'
import { NaoRouterLink } from '@nao-todo/shared/components/router-link'
import { useBuiltInProjectsStore } from '@nao-todo/presentation/built-in-project'
import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import pomodoroRoutes from '@/views/index/pomodoro/routes'
import tasksRoutes from '@/views/index/tasks/routes'
import AppAside from '../aside/aside.vue'
import PomodoroAside from '../../pomodoro/aside/aside.vue'
import PomodoroHeader from '../../pomodoro/header/header.vue'
import TasksAside from '../../tasks/aside/aside.vue'

/**
 * T603 红基线 —— 导航可访问性规避（`DEF-116` / PRD `2026-10-31-nav-a11y-and-cleanup` AC1/AC3/AC4）
 *
 * 现状（`nue-ui@1.13.0`）：`nue-link` 的 `route` 形态渲染 `<a class="nue-link">` **无 `href`**
 * ⇒ 键盘 Tab / 中键新标签 / 读屏链接语义全部失效（鼠标点击仍可导航）。
 *
 * 纪律（PRD R2）：**必须真实挂载**（真实 router + 真实 `nue-link` / `NaoRouterLink`）；
 * 禁止用 stub 证明框架行为。样式只做结构断言（主题类名存在），像素级留给用户走查（R5）。
 *
 * 状态：**红**（AC1/AC3 全部红；AC4 的「无 `to="[object Object]"`」当前为绿）。
 * 变异易感：把任一调用点改回 `nue-link route=…` ⇒ 对应 AC1 断言红。
 */

const stub = { template: '<div />' }

/** 递归把路由组件的懒加载换成 stub（只关心导航渲染，不加载页面） */
const withStubComponents = (route: RouteRecordRaw): RouteRecordRaw =>
    ({
        ...route,
        component: stub,
        ...(route.components
            ? {
                  components: Object.fromEntries(
                      Object.keys(route.components).map((k) => [k, stub])
                  )
              }
            : {}),
        ...(route.children ? { children: route.children.map(withStubComponents) } : {})
    }) as RouteRecordRaw

/** 真实路由：任务（内建清单/清单/标签）+ 番茄钟 4 页 + 日历 + 搜索 */
const buildRouter = () =>
    createRouter({
        history: createMemoryHistory(),
        routes: [
            {
                path: '/',
                component: stub,
                children: [
                    withStubComponents(tasksRoutes),
                    withStubComponents(pomodoroRoutes),
                    { path: 'calendar', name: 'calendar', component: stub },
                    { path: 'search/:taskId?', name: 'search', component: stub }
                ]
            }
        ]
    })

/** 与 `apps/web/src/app.ts` 的 `routerLinks` 同值（主导航 4 项） */
const MAIN_NAV_ROUTES = ['/tasks', '/calendar', '/pomodoro', '/search'] as const
const MAIN_NAV_LINKS = [
    { name: '任务', icon: 'ntd-logo1', route: MAIN_NAV_ROUTES[0], routeName: 'tasks' },
    { name: '日历', icon: 'ntd-calendar', route: MAIN_NAV_ROUTES[1], routeName: 'calendar' },
    { name: '番茄钟', icon: 'ntd-fanqie', route: MAIN_NAV_ROUTES[2], routeName: 'pomodoro' },
    { name: '搜索', icon: 'ntd-search', route: MAIN_NAV_ROUTES[3], routeName: 'search' }
]

/** 真实内建清单 id（`packages/infrastructure/src/built-in/project/default.ts`） */
const BUILT_IN_IDS = [
    'all',
    'today',
    'tomorrow',
    'week',
    'inbox',
    'favourite',
    'deleted',
    'overdue',
    'givenup'
]

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
        ariaLabel: a.getAttribute('aria-label'),
        title: a.getAttribute('title'),
        class: a.className
    }))

/** 可访问名（R2：截图/像素不算证据，链接必须能被读屏念出来） */
const accessibleName = (a: HTMLAnchorElement): string =>
    (a.getAttribute('aria-label') || a.getAttribute('title') || a.textContent || '').trim()

/** 三重证据的最后一条：`focus()` 后 `document.activeElement` 命中（jsdom 的 `tabIndex` 对无 href 锚点也报 0，不可单用） */
const focusHits = (a: HTMLAnchorElement): boolean => {
    a.focus()
    return document.activeElement === a
}

beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
})

afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    wrappers = []
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

const mountAppAside = async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = buildRouter()
    useUserStore().setUserProfile({ nickname: '验收用户' } as never)
    await router.push('/tasks')
    await router.isReady()
    const wrapper = track(
        mount(AppAside, {
            attachTo: document.body,
            global: {
                plugins: [pinia, router, nueUI],
                provide: {
                    [APP_CONTEXT_KEY as symbol]: { routerLinks: MAIN_NAV_LINKS }
                }
            }
        })
    )
    await flushPromises()
    return { wrapper, router }
}

const mountNaoRouterLink = async () => {
    const router = buildRouter()
    await router.push('/tasks')
    await router.isReady()
    const objectRoute = { name: 'tasks-built-in-project', params: { projectId: 'today' } }
    const Host = defineComponent({
        setup: () => () =>
            h('div', [
                h(NaoRouterLink, { route: '/tasks', icon: 'ntd-logo1', iconLink: true }),
                h(NaoRouterLink, { route: objectRoute, icon: 'list' })
            ])
    })
    const wrapper = track(mount(Host, { global: { plugins: [router] } }))
    await flushPromises()
    return { wrapper, router, objectRoute }
}

const mountPomodoroAside = async () => {
    const router = buildRouter()
    await router.push('/pomodoro/timer')
    await router.isReady()
    const wrapper = track(
        mount(PomodoroAside, {
            attachTo: document.body,
            global: {
                plugins: [nueUI, router],
                stubs: { teleport: true, RecordListItem: true },
                provide: {
                    [POMODORO_VIEW_CONTEXT_KEY as symbol]: {
                        isDisplayAside: ref(true),
                        todayRecords: ref([]),
                        recordLoading: ref(false),
                        recordIsDone: ref(true),
                        handleNextPage: vi.fn()
                    },
                    [INDEX_VIEW_CONTEXT_KEY as symbol]: { setControllOption: vi.fn() }
                }
            }
        })
    )
    await flushPromises()
    return { wrapper, router }
}

const mountTasksAside = async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = buildRouter()
    useBuiltInProjectsStore().setBuiltInProjects(
        BUILT_IN_IDS.map((id, index) => ({
            id,
            name: `内建 ${index + 1}`,
            icon: 'list'
        })) as never
    )
    useProjectsStore().setProjects([
        { id: 'project-1', name: '自建清单一', isDeleted: false, isArchived: false, sortId: 1 }
    ] as never)
    useTagsStore().setTags([{ id: 'tag-1', name: '自建标签一', sortId: 1, color: 'red' }] as never)
    await router.push('/tasks/all')
    await router.isReady()
    const wrapper = track(
        mount(TasksAside, {
            attachTo: document.body,
            global: {
                plugins: [pinia, router, nueUI],
                stubs: { teleport: true },
                provide: {
                    [INDEX_VIEW_CONTEXT_KEY as symbol]: {
                        asideWidth: ref(300),
                        handleResizeAside: vi.fn(),
                        isDisplayAside: ref(true),
                        isUseFloatAside: ref(false),
                        setControllOption: vi.fn()
                    },
                    [TASKS_VIEW_CONTEXT_KEY as symbol]: {
                        appDialogManager: { open: vi.fn() }
                    }
                }
            }
        })
    )
    await flushPromises()
    return { wrapper, router }
}

const mountPomodoroHeader = async () => {
    const router = buildRouter()
    await router.push('/pomodoro/timer')
    await router.isReady()
    const wrapper = track(
        mount(PomodoroHeader, {
            attachTo: document.body,
            global: {
                plugins: [nueUI, router],
                provide: {
                    [POMODORO_VIEW_CONTEXT_KEY as symbol]: {
                        isDisplayAside: ref(false),
                        switchDisplayAside: vi.fn()
                    }
                }
            }
        })
    )
    await flushPromises()
    return { wrapper, router }
}

describe('T603 AC1 · 静态调用点渲染的 <a> 均有非空 href = router.resolve(path).href', () => {
    it('AC1① 主导航 4 项（任务 / 日历 / 番茄钟 / 搜索）—— 真实 AppAside 挂载', async () => {
        const { wrapper, router } = await mountAppAside()
        const expected = MAIN_NAV_ROUTES.map(
            (route) => (router.resolve(route) as unknown as { href: string }).href
        )

        expect(
            hrefs(wrapper),
            `主导航锚点实测：${JSON.stringify(describeAnchors(wrapper))}`
        ).toEqual([...expected])
    })

    it('AC1② `NaoRouterLink` 包装（字符串 route + 对象 route）均透传出 href', async () => {
        const { wrapper, router, objectRoute } = await mountNaoRouterLink()
        const expected = [
            (router.resolve('/tasks') as unknown as { href: string }).href,
            (router.resolve(objectRoute) as unknown as { href: string }).href
        ]

        expect(
            hrefs(wrapper),
            `NaoRouterLink 锚点实测：${JSON.stringify(describeAnchors(wrapper))}`
        ).toEqual(expected)
        // R5 结构证据：主题类必须保留（外观由类名承载，像素级交用户走查）
        const [first, second] = anchors(wrapper)
        expect(first!.className).toContain('nue-link--route')
        expect(first!.className).toContain('nue-link--route-icon')
        expect(second!.className).toContain('nue-link--route')
    })

    it('AC1③ 番茄钟侧栏 4 项（专注 / 正计时 / 常用专注 / 记录）', async () => {
        const { wrapper, router } = await mountPomodoroAside()
        const { taskId } = { taskId: undefined }
        const routes = [
            { name: 'pomodoro', params: { type: 'timer', taskId } },
            { name: 'pomodoro', params: { type: 'focus', taskId } },
            { name: 'pomodoro-collection', params: { taskId } },
            { name: 'pomodoro-records', params: { taskId } }
        ]
        const expected = routes.map(
            (route) => (router.resolve(route) as unknown as { href: string }).href
        )

        expect(
            hrefs(wrapper),
            `番茄钟侧栏锚点实测：${JSON.stringify(describeAnchors(wrapper))}`
        ).toEqual(expected)
        anchors(wrapper).forEach((a) => expect(a.className).toContain('nue-link--route'))
    })

    it('AC1④ 任务侧栏：9 个内建清单 + 自建清单 + 自建标签', async () => {
        const { wrapper, router } = await mountTasksAside()
        const builtInHref = (projectId: string): string =>
            (
                router.resolve({
                    name: 'tasks-built-in-project',
                    params: { projectId }
                }) as unknown as { href: string }
            ).href
        // 模板顺序：前 5 个内建清单 → 自建清单 → 自建标签 → 其余内建清单
        const expected = [
            ...BUILT_IN_IDS.slice(0, 5).map(builtInHref),
            (
                router.resolve({
                    name: 'tasks-project',
                    params: { projectId: 'project-1' }
                }) as unknown as { href: string }
            ).href,
            (
                router.resolve({ name: 'tasks-tag', params: { tagId: 'tag-1' } }) as unknown as {
                    href: string
                }
            ).href,
            ...BUILT_IN_IDS.slice(5).map(builtInHref)
        ]

        expect(
            hrefs(wrapper),
            `任务侧栏锚点实测：${JSON.stringify(describeAnchors(wrapper))}`
        ).toEqual(expected)
        anchors(wrapper)
            .filter((a) => a.getAttribute('href'))
            .forEach((a) => expect(a.className).toContain('nue-link--route'))
    })

    it('AC1⑤ 番茄钟顶栏：源码 4 处调用点当前在 HTML 注释内（死件）—— 有锚点就必须有 href', async () => {
        // 核查结论：`apps/web/src/components/pomodoro/header/header.vue:51-59` 的 4 个
        // `nue-link route=…` 被 `<!-- … -->` 包住（T452 头部改造后不再渲染）。
        // 本用例不是「空过」：一旦该区块被重新启用，锚点必须带 href（否则红）。
        const { wrapper } = await mountPomodoroHeader()
        const found = anchors(wrapper)
        found.forEach((a) =>
            expect(
                a.getAttribute('href'),
                `顶栏锚点实测：${JSON.stringify(describeAnchors(wrapper))}`
            ).toBeTruthy()
        )
        expect(found.length).toBeLessThanOrEqual(4)
    })
})

describe('T603 AC3 · 可访问性三重证据（tabIndex / focus 命中 / 可访问名）', () => {
    const expectAccessibleNav = (wrapper: VueWrapper, label: string) => {
        const navAnchors = anchors(wrapper).filter((a) => a.getAttribute('href'))
        expect(
            navAnchors.length,
            `${label}：前置 AC1 必须已有 href；实测 ${JSON.stringify(describeAnchors(wrapper))}`
        ).toBeGreaterThan(0)
        navAnchors.forEach((a) => {
            const detail = `${label} 链接实测：${JSON.stringify(describeAnchors(wrapper))}`
            expect(a.tabIndex, detail).toBeGreaterThanOrEqual(0)
            expect(focusHits(a), `${detail}（focus() 后 activeElement 未命中）`).toBe(true)
            expect(accessibleName(a), `${detail}（无可访问名，只有图标）`).not.toBe('')
        })
    }

    it('AC3① 主导航 4 项均可聚焦且有可访问名', async () => {
        const { wrapper } = await mountAppAside()
        expectAccessibleNav(wrapper, '主导航')
    })

    it('AC3② 番茄钟侧栏 4 项均可聚焦且有可访问名', async () => {
        const { wrapper } = await mountPomodoroAside()
        expectAccessibleNav(wrapper, '番茄钟侧栏')
    })

    it('AC3③ 任务侧栏（内建 / 自建清单 / 标签）均可聚焦且有可访问名', async () => {
        const { wrapper } = await mountTasksAside()
        expectAccessibleNav(wrapper, '任务侧栏')
    })
})

describe('T603 AC4 · 负向（无 to="[object Object]" 残留 + 点击仍走 SPA）', () => {
    const expectNoLegacyTo = (label: string, wrapper: VueWrapper) => {
        // `teleport-stub` 自带 `to="#slot"`（框架产物，不是缺陷面）⇒ 只看链接元素
        const offenders = wrapper.findAll('a[to]')
        expect(
            offenders.length,
            `${label} 链接残留 to 属性：${offenders.map((a) => a.html()).join(' | ')}`
        ).toBe(0)
        expect(wrapper.html(), label).not.toContain('[object Object]')
    }

    it('AC4①a AppAside 无 `to` 属性残留、无 `[object Object]`', async () => {
        const { wrapper } = await mountAppAside()
        expectNoLegacyTo('AppAside', wrapper)
    })

    it('AC4①b NaoRouterLink 无 `to` 属性残留、无 `[object Object]`', async () => {
        const { wrapper } = await mountNaoRouterLink()
        expectNoLegacyTo('NaoRouterLink', wrapper)
    })

    it('AC4①c PomodoroAside 无 `to` 属性残留、无 `[object Object]`', async () => {
        const { wrapper } = await mountPomodoroAside()
        expectNoLegacyTo('PomodoroAside', wrapper)
    })

    it('AC4①d TasksAside 无 `to` 属性残留、无 `[object Object]`', async () => {
        const { wrapper } = await mountTasksAside()
        expectNoLegacyTo('TasksAside', wrapper)
    })

    it('AC4② 点击导航项仍走 SPA（router 变化、默认行为被拦截、不整页刷新）', async () => {
        const { wrapper, router } = await mountAppAside()
        const calendarLink = anchors(wrapper).find(
            (a) => a.getAttribute('href') === router.resolve('/calendar').href
        )
        expect(
            calendarLink,
            `未找到日历导航锚点：${JSON.stringify(describeAnchors(wrapper))}`
        ).toBeTruthy()

        const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
        calendarLink!.dispatchEvent(event)
        await flushPromises()

        expect(event.defaultPrevented, 'router-link 应拦截默认整页跳转').toBe(true)
        expect(router.currentRoute.value.path).toBe('/calendar')
    })
})