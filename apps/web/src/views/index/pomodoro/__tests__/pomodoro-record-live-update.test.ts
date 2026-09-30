// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, inject, ref } from 'vue'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { APP_CONTEXT_KEY } from '@/context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { useSubscriber } from '@nao-todo/shared/hooks'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'
import { useCaseBinding } from '@/hooks/usecases/binding'
import { usePomodoroSessionStore, usePomodoroTimerStore } from '@nao-todo/presentation/pomodoro'
import { usePomodoroView } from '@/views/index/pomodoro/pomodoro-view'
import { usePomodoroPage } from '@/components/pomodoro/use-pomodoro-page'
import PomodoroAside from '@/components/pomodoro/aside/aside.vue'
import { nueUI } from '@/nue-ui-register'

/**
 * T456 ① 真实链路：番茄结束 → 记录落库 → 侧栏「今日专注」即时出现
 * @description 不复用「直接调 store.addRecord」的简化用例，而是走**真实链路**：
 *              timerStore.start/skip/end → persistPomodoroRecord → createRecordFn
 *              → PomodoroRecordUseCase.createRecord → store.addRecord → 侧栏 loader prepend。
 *              （仓储经 `useCaseBinding` 注入伪实现，避免 jsdom 无 IndexedDB。）
 */

beforeAll(() => {
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

const entity = {
    id: 'rec1',
    sessionId: 's',
    type: 1,
    startAt: '2026-10-01T00:00:00.000Z',
    endAt: '2026-10-01T00:25:00.000Z',
    duration: 1500,
    pomodoroId: '',
    taskId: '',
    taskName: '',
    description: '',
    note: '',
    createdAt: '',
    updatedAt: '',
    deletedAt: null
}
const stub = { template: '<div/>' }
const routes: RouteRecordRaw[] = [
    {
        path: '/',
        component: stub,
        children: [
            { path: 'pomodoro/pomodoros/:taskId?', name: 'pomodoro-collection', component: stub },
            { path: 'pomodoro/records/:taskId?', name: 'pomodoro-records', component: stub },
            { path: 'pomodoro/:type/:taskId?', name: 'pomodoro', component: stub }
        ]
    }
]

const Child = defineComponent({
    setup() {
        const { dialogManager } = inject(POMODORO_VIEW_CONTEXT_KEY)!
        usePomodoroPage(dialogManager)
        return () => h('div')
    }
})
const Harness = defineComponent({
    setup() {
        usePomodoroView()
        return () => h('div', [h(Child), h(PomodoroAside)])
    }
})

const mountHarness = async (): Promise<VueWrapper> => {
    const pinia = createPinia()
    setActivePinia(pinia)
    vi.spyOn(useCaseBinding, 'createPomodoroRecordRepository').mockReturnValue({
        get: async () => [entity as never, null],
        create: async () => [entity as never, null],
        list: async () => [
            { entities: [], pagination: { total: 0, page: 1, limit: 20, maxPage: 1 } },
            null
        ]
    } as never)
    vi.spyOn(useCaseBinding, 'createPomodoroRepository').mockReturnValue({
        get: async () => [null, null],
        list: async () => [
            { pomodoroEntities: [], pagination: { total: 0, page: 1, limit: 20, maxPage: 1 } },
            null
        ]
    } as never)

    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/pomodoro/timer')
    await router.isReady()

    const wrapper = mount(Harness, {
        attachTo: document.body,
        global: {
            plugins: [pinia, nueUI, router],
            stubs: { teleport: true, RecordListItem: true },
            provide: {
                [APP_CONTEXT_KEY as symbol]: { responsiveFlag: ref(0) },
                [INDEX_VIEW_CONTEXT_KEY as symbol]: {
                    appDialogManager: { open: vi.fn() },
                    appSubscriber: useSubscriber(),
                    getProjectName: () => '',
                    showTaskDetails: vi.fn(),
                    isDisplayAside: ref(true),
                    isUseFloatAside: ref(false),
                    switchDisplayAside: vi.fn(),
                    setControllOption: vi.fn()
                }
            }
        }
    })
    await flushPromises()
    const sessionStore = usePomodoroSessionStore()
    sessionStore.setFocusDuration(1500)
    const timerStore = usePomodoroTimerStore()
    timerStore.updateConfig()
    return wrapper
}

const sidebarIds = (wrapper: VueWrapper): string[] => {
    const props = wrapper.findComponent({ name: 'PomodoroRecordList' }).props() as unknown as {
        records: { id: string }[]
    }
    return props.records.map((r) => r.id)
}

describe('T456 ① 真实链路：番茄结束 → 侧栏即时出现', () => {
    it('「结束专注」end() ⇒ 侧栏出现该记录', async () => {
        const wrapper = await mountHarness()
        const timerStore = usePomodoroTimerStore()
        timerStore.start()
        timerStore.end()
        await flushPromises()
        await flushPromises()
        expect(sidebarIds(wrapper)).toContain('rec1')
        wrapper.unmount()
    })

    it('「跳过专注」skip() ⇒ 侧栏出现该记录（回归）', async () => {
        const wrapper = await mountHarness()
        const timerStore = usePomodoroTimerStore()
        timerStore.start()
        timerStore.skip()
        await flushPromises()
        await flushPromises()
        expect(sidebarIds(wrapper)).toContain('rec1')
        wrapper.unmount()
    })
})