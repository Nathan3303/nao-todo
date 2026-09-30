// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'
import { nueUI } from '@/nue-ui-register'
import pomodoroRoutes from '@/views/index/pomodoro/routes'
import PomodoroAside from '../aside.vue'

/**
 * T451 番茄页侧栏：① 今日专注 collapse + 列表数据/分页；② 子视图导航携带 taskId
 */

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

const buildRouter = () => {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            {
                path: '/',
                component: stub,
                children: [withStubComponents(pomodoroRoutes)]
            }
        ]
    })
    return router
}

const buildPomodoroContext = (handleNextPage = vi.fn(async () => {})) => ({
    isDisplayAside: ref(true),
    dialogManager: { open: vi.fn() },
    todayRecords: ref([{ id: 'r1' }]),
    recordLoading: ref(false),
    recordIsDone: ref(false),
    handleNextPage
})

const buildIndexContext = () => ({ setControllOption: vi.fn() })

let wrapper: VueWrapper | null = null

beforeAll(() => {
    // nue-infinite-scroll 依赖 IntersectionObserver（jsdom 不提供）
    vi.stubGlobal(
        'IntersectionObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
            takeRecords() {
                return []
            }
        }
    )
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const mountAside = async (path: string) => {
    const router = buildRouter()
    await router.push(path)
    await router.isReady()
    const handleNextPage = vi.fn(async () => {})
    wrapper = mount(PomodoroAside, {
        attachTo: document.body,
        global: {
            plugins: [nueUI, router],
            stubs: { teleport: true, RecordListItem: true },
            provide: {
                [POMODORO_VIEW_CONTEXT_KEY as symbol]: buildPomodoroContext(handleNextPage),
                [INDEX_VIEW_CONTEXT_KEY as symbol]: buildIndexContext()
            }
        }
    })
    await flushPromises()
    return { router, handleNextPage }
}

const recordList = (): VueWrapper => wrapper!.findComponent({ name: 'PomodoroRecordList' })
const recordListProps = (): Record<string, unknown> =>
    recordList().props() as unknown as Record<string, unknown>

const asideCss = (): string =>
    Object.values(
        import.meta.glob('../aside.vue', {
            query: '?raw',
            import: 'default',
            eager: true
        }) as Record<string, string>
    )
        .join('\n')
        .replace(/\s+/g, ' ')

describe('T451 ① 今日专注入侧栏（NueCollapse）', () => {
    it('侧栏渲染「今日专注」collapse，且列表 hideHeader（标题不重复）', async () => {
        await mountAside('/pomodoro/timer')
        expect(wrapper!.text()).toContain('今日专注')
        // 列表自身内置标题已隐藏（避免与 collapse 标题重复；统计卡的「今日专注目标」不算标题）
        expect(recordListProps().hideHeader).toBe(true)
        expect(recordListProps().compact).toBe(true)
        expect(recordList().find('.nue-div--header').exists()).toBe(false)
    })

    it('列表拿到 todayRecords 数据与分页态', async () => {
        await mountAside('/pomodoro/timer')
        const props = recordListProps()
        expect((props.records as unknown[]).length).toBe(1)
        expect(props.loading).toBe(false)
        expect(props.disabledNextPage).toBe(false)
    })

    it('列表 next-page ⇒ 转发到 handleNextPage', async () => {
        const { handleNextPage } = await mountAside('/pomodoro/timer')
        recordList().vm.$emit('nextPage')
        await flushPromises()
        expect(handleNextPage).toHaveBeenCalledTimes(1)
    })
})

describe('T455 B 「今日专注」仅计时页显示', () => {
    it('番茄专注 / 正计时 ⇒ 渲染「今日专注」区块', async () => {
        await mountAside('/pomodoro/timer')
        expect(recordList().exists()).toBe(true)
        expect(wrapper!.text()).toContain('今日专注')

        wrapper!.unmount()
        await mountAside('/pomodoro/focus')
        expect(recordList().exists()).toBe(true)
    })

    it('常用专注 / 专注记录 ⇒ 不渲染该区块（导航仍在）', async () => {
        await mountAside('/pomodoro/pomodoros')
        expect(recordList().exists()).toBe(false)
        expect(wrapper!.text()).not.toContain('今日专注')
        expect(wrapper!.findAll('a').length).toBeGreaterThanOrEqual(4)

        wrapper!.unmount()
        await mountAside('/pomodoro/records')
        expect(recordList().exists()).toBe(false)
        expect(wrapper!.text()).not.toContain('今日专注')
    })

    it('T456 ③ 源级：展开态折叠内容填满高度（概览固定 + 列表可滚）；收起态 0 高', () => {
        const flat = asideCss()
        expect(flat).toContain("data-collapsed='false'] .nue-collapse-item__content")
        expect(flat).toContain('height: auto !important')
        expect(flat).toContain('min-height: 0')
        expect(flat).toContain("data-collapsed='true'] .nue-collapse-item__content")
        expect(flat).toContain('height: 0 !important')
    })
})

describe('T451 ② 侧栏导航携带 taskId（子视图切换不重置详情）', () => {
    it('在 /pomodoro/timer/abc ⇒ 链接切到四个子视图均保留 abc', async () => {
        const { router } = await mountAside('/pomodoro/timer/abc')
        const links = wrapper!.findAll('a')
        // 次序：番茄专注 / 正计时 / 常用专注 / 专注记录
        await links[2]!.trigger('click')
        await flushPromises()
        expect(router.currentRoute.value.name).toBe('pomodoro-collection')
        expect(router.currentRoute.value.params.taskId).toBe('abc')

        await wrapper!.findAll('a')[3]!.trigger('click')
        await flushPromises()
        expect(router.currentRoute.value.name).toBe('pomodoro-records')
        expect(router.currentRoute.value.params.taskId).toBe('abc')

        await wrapper!.findAll('a')[0]!.trigger('click')
        await flushPromises()
        expect(router.currentRoute.value.params.type).toBe('timer')
        expect(router.currentRoute.value.params.taskId).toBe('abc')

        await wrapper!.findAll('a')[1]!.trigger('click')
        await flushPromises()
        expect(router.currentRoute.value.params.type).toBe('focus')
        expect(router.currentRoute.value.params.taskId).toBe('abc')
    })

    it('无 taskId ⇒ 切子视图不产生多余参数段', async () => {
        const { router } = await mountAside('/pomodoro/timer')
        await wrapper!.findAll('a')[2]!.trigger('click')
        await flushPromises()
        expect(router.currentRoute.value.fullPath).toBe('/pomodoro/pomodoros')
    })
})