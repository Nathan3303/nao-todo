// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { nueUI } from '@/nue-ui-register'
import { APP_CONTEXT_KEY } from '@/context'
import { useUserStore } from '@nao-todo/presentation-identity'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import AppAsideV2 from '../aside-v2/aside-v2.vue'

/**
 * T633 AC1② · **图标型**导航入口的 `nue-link--route-icon` 类真实存在
 *
 * 为什么单独成文件（`T628` R1 / §5 S4 判据）：`nue-link` 的类名**只能由 `theme` 产生**
 * （`parseTheme` 按逗号切分），而 `iconLink` / `size` 在 `nue-link` 上不存在或未实现
 * ⇒ 写成 `theme="route"`（漏 `route-icon`）**不报错、门禁全绿**，只是图标导航项静默失去
 * 方形尺寸与主题色。既有 `t603-nav-a11y` 的 `--route-icon` 断言落在**合成挂载**上
 * （`h(NueLink, …)`），**不覆盖真实调用点** —— 因此把真实入口写坏，`t603` 仍会绿。
 * 本文件补的正是这条：真实组件 + 真实调用点。
 *
 * 覆盖面：能低成本真实挂载的 `AppAsideV2`（4 项主导航图标）走运行期断言；
 * 其余入口（`aside-v2` 自身源码形态 / `aside-v2-drawer` / `pomodoro/indicator`）
 * 成本高（需大上下文），走**源级写法断言**（写错同样会红）。
 */

// 侧栏会挂载设置对话框（与主题类断言无关的独立子树，且自带 UI/服务依赖）⇒ 只隔离它，
// ⛔ 不隔离任何导航元素（`nue-link` 均真实挂载）
vi.mock('@/components/settings/dialog', async () => {
    const { ref } = await import('vue')
    return {
        AppSettingsDialog: { name: 'AppSettingsDialog', render: () => null },
        open: ref(false),
        openSettingsDialog: vi.fn()
    }
})

const stub = { template: '<div />' }

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

const buildRouter = () =>
    createRouter({
        history: createMemoryHistory(),
        routes: [
            {
                path: '/',
                component: stub,
                children: [
                    { path: 'tasks', name: 'tasks', component: stub },
                    { path: 'calendar', name: 'calendar', component: stub },
                    { path: 'pomodoro', name: 'pomodoro', component: stub },
                    { path: 'search', name: 'search', component: stub }
                ].map(withStubComponents)
            }
        ]
    })

const MAIN_NAV_LINKS = [
    { name: '任务', icon: 'ntd-logo1', route: '/tasks' },
    { name: '日历', icon: 'ntd-calendar', route: '/calendar' },
    { name: '番茄钟', icon: 'ntd-fanqie', route: '/pomodoro' },
    { name: '搜索', icon: 'ntd-search', route: '/search' }
]

const ICON_ENTRY_SOURCES = [
    '/apps/web/src/components/app/aside-v2/aside-v2.vue',
    '/apps/web/src/components/app/aside-v2/aside-v2-drawer.vue',
    '/packages/presentation/pomodoro/components/indicator/indicator.vue'
]

const sources = import.meta.glob(
    [
        '/apps/web/src/components/app/aside-v2/aside-v2.vue',
        '/apps/web/src/components/app/aside-v2/aside-v2-drawer.vue',
        '/packages/presentation/pomodoro/components/indicator/indicator.vue'
    ],
    { query: '?raw', import: 'default', eager: true }
) as Record<string, string>

let wrappers: VueWrapper[] = []

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

describe('T633 AC1② · 图标型入口真实挂载后带 --route / --route-icon', () => {
    it('AppAsideV2 的 4 个主导航图标项均有两个主题类（漏 route-icon 即红）', async () => {
        const pinia = createPinia()
        setActivePinia(pinia)
        const router = buildRouter()
        useUserStore().setUserProfile({ nickname: '验收用户' } as never)
        await router.push('/tasks')
        await router.isReady()

        const wrapper = mount(AppAsideV2, {
            attachTo: document.body,
            global: {
                plugins: [pinia, router, nueUI],
                provide: {
                    [APP_CONTEXT_KEY as symbol]: { routerLinks: MAIN_NAV_LINKS },
                    [INDEX_VIEW_CONTEXT_KEY as symbol]: {
                        isDisplayAside: ref(true),
                        isUseFloatAside: ref(false),
                        switchDisplayAside: vi.fn(),
                        asideWidth: ref(300),
                        handleResizeAside: vi.fn()
                    }
                }
            }
        })
        wrappers.push(wrapper)
        await flushPromises()

        // 重定向自证：挂载的确为 aside-v2（v1 无此齿轮按钮）⇒ 防「删了 v1 而测试静默挂空壳」
        expect(wrapper.find('#AppAsideSettingsGearBtn').exists()).toBe(true)

        const anchors = wrapper.findAll('a')
        expect(anchors).toHaveLength(4)
        const classes = anchors.map((a) => (a.element as HTMLAnchorElement).className)
        classes.forEach((className, index) => {
            expect(
                className,
                `第 ${index + 1} 个导航项缺 nue-link--route；实测 class="${className}"`
            ).toContain('nue-link--route')
            expect(
                className,
                `第 ${index + 1} 个导航项缺 nue-link--route-icon（theme 写法漏项 ⇒ 静默视觉回归）；实测 class="${className}"`
            ).toContain('nue-link--route-icon')
        })
    })
})

describe('T633 AC1② · 其余 3 处图标入口的写法（源级，防同一类静默失效）', () => {
    it.each(ICON_ENTRY_SOURCES)('%s 的 nue-link 使用对象语法且含 route-icon', (path) => {
        const source = sources[path]
        expect(source, `未读到源码：${path}`).toBeTruthy()
        // 图标型入口必须是 `{ route: true, 'route-icon': true }`（禁 theme="route icon" 空格写法）
        expect(source).toContain("'route-icon': true")
        expect(source, `${path}：不得出现被空格分隔的 theme 字符串`).not.toMatch(
            /theme="route\s+route-icon"/
        )
    })
})