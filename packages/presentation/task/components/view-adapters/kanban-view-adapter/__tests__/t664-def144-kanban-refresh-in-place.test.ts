// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref, type Ref } from 'vue'
import { defaultColumns } from '@nao-todo/shared/constants'
import { useSubscriber } from '@nao-todo/shared/hooks'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '../../../../stores'
import KanbanViewAdapter from '../kanban-view-adapter.vue'
import { KANBAN_GROUP_BY_KEY } from '../../../kanban/use-kanban-group'
import { NUE_COMPONENTS, makeTask } from '../../../kanban/__tests__/t608-kanban-harness'

/**
 * `T664` / `DEF-144` 看板落点 —— 自动刷新重载**不得**抖动（AC-K1 / AC-K2 / AC-K3）
 *
 * @description 复现路径（生产）：自动拉取落库 ⇒ `notifyDataChanged` ⇒ `RefreshData`
 *              ⇒ 看板 `refreshToken++` ⇒ 各列 `reset()` ⇒ `loadAndReplace()`。
 *              **红基线根因（qa `T663` 实测 + 本单复核）**：`loadingFirst`/`loadingMore` 仍吃
 *              `loader.states.loading`，而 `reset()` 走非 silent 加载 ⇒ 在飞期间
 *              ① 每列底部插 1 条 `.nue-infinite-scroll__loading-bar`；
 *              ② 空列占位从「无待办任务」变「正在加载任务」。
 *              （复核实测：`{"bars":2,"cards":2,"loadingText":true}`）
 *
 * 断言口径（AC-K1）：刷新**在飞期间**采样 ① loading bar 数 ② 空列占位文案 ③ 卡片数（+ 卡片节点身份）。
 */

const SETTLE = async (): Promise<void> => {
    for (let i = 0; i < 8; i += 1) {
        await nextTick()
        await Promise.resolve()
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
}

const makeDeferred = () => {
    let resolve: (value?: unknown) => void = () => {}
    const promise = new Promise<unknown>((r) => (resolve = r))
    return { promise, resolve }
}

type Sample = {
    bars: number
    cards: number
    cardNodes: Element[]
    loadingText: boolean
    emptyText: boolean
}

const sample = (wrapper: VueWrapper): Sample => {
    const root = wrapper.element as HTMLElement
    const cardNodes = Array.from(root.querySelectorAll('[data-taskid]')) as Element[]
    const text = root.textContent ?? ''
    return {
        bars: root.querySelectorAll('.nue-infinite-scroll__loading-bar').length,
        cards: cardNodes.length,
        cardNodes,
        loadingText: text.includes('正在加载任务'),
        emptyText: text.includes('无待办任务')
    }
}

type Harness = {
    wrapper: VueWrapper
    store: ReturnType<typeof useTasksStore>
    emit: (event: string, ...args: unknown[]) => void
    park: () => { promise: Promise<unknown>; resolve: (v?: unknown) => void }
    release: () => void
    setFail: (fail: boolean) => void
    listCalls: () => number
}

let mounted: VueWrapper[] = []
afterEach(() => {
    mounted.forEach((wrapper) => wrapper.unmount())
    mounted = []
    document.body.innerHTML = ''
})

const SECTION = ['todo', 'in-progress', 'done'] as const

const mountKanban = (seed: TaskViewObject[], options: { failOnMount?: boolean } = {}): Harness => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useTasksStore(pinia)
    store.addTasks(seed.map((task) => ({ ...task })))

    let gate: { promise: Promise<unknown>; resolve: (v?: unknown) => void } | null = null
    let fail = options.failOnMount === true
    let calls = 0
    const list = vi.fn(async (options: { state?: string }) => {
        calls += 1
        if (gate) await gate.promise
        if (fail) return [null, '10051']
        const state = String(options?.state ?? '')
        const matched = seed.filter((task) => task.state === state)
        store.addTasks(matched.map((task) => ({ ...task })))
        return [
            {
                taskIds: matched.map((task) => task.id),
                pagination: { total: matched.length, page: 1, limit: 20, maxPage: 1 }
            },
            null
        ]
    })
    const taskUseCase = {
        list,
        update: vi.fn(async () => null),
        delete: vi.fn(async () => null),
        restore: vi.fn(async () => null)
    } as unknown as TaskUseCase

    const subscriber = useSubscriber()
    const groupBy: Ref<string> = ref('state')
    const wrapper = mount(KanbanViewAdapter, {
        props: {
            taskUseCase,
            getTasksOptions: {},
            subscriber,
            dialogManager: { open: vi.fn(), close: vi.fn() },
            tags: [],
            columns: { ...defaultColumns },
            getNoTaskError: () => undefined,
            getColumnLabel: (key: string) => key,
            getProjectName: () => '',
            showTaskDetails: vi.fn(),
            updateColumns: vi.fn(),
            updateSortOptions: vi.fn(),
            clearSortOptions: vi.fn(),
            multiSelectClearSignal: 0
        } as never,
        global: {
            plugins: [pinia],
            components: NUE_COMPONENTS,
            mocks: { $route: { params: {} } },
            provide: { [KANBAN_GROUP_BY_KEY as symbol]: groupBy }
        }
    })
    mounted.push(wrapper)

    return {
        wrapper,
        store,
        emit: (event, ...args) => subscriber.emit(event as never, ...args),
        park: () => (gate = makeDeferred()),
        release: () => {
            const current = gate
            gate = null
            current?.resolve(undefined)
        },
        setFail: (next) => {
            fail = next
        },
        listCalls: () => calls
    }
}

describe('T664 / DEF-144 · 看板自动刷新不抖（AC-K1）', () => {
    it('刷新在飞期间：不出现列底加载条、空列占位不变、卡片数与节点身份不变', async () => {
        const seed = [
            makeTask({ id: 'k1', state: 'todo' }),
            makeTask({ id: 'k2', state: 'in-progress' })
        ]
        const harness = mountKanban(seed)
        await SETTLE()

        const before = sample(harness.wrapper)
        expect(before.cards).toBe(2)
        expect(before.bars, '刷新前不应有加载条').toBe(0)
        expect(before.emptyText, '空列（done）占位 = 无待办任务').toBe(true)

        harness.park()
        harness.emit('RefreshData')
        await SETTLE()

        const during = sample(harness.wrapper)
        expect(during.bars, '刷新在飞期间不得插入列底加载条').toBe(0)
        expect(during.loadingText, '空列占位不得换成「正在加载任务」').toBe(false)
        expect(during.emptyText, '空列占位保持不变').toBe(true)
        expect(during.cards, '卡片数不得变化').toBe(before.cards)
        expect(during.cardNodes, '卡片 DOM 身份不得重建（高度不跳变的结构代理）').toEqual(
            before.cardNodes
        )

        harness.release()
        await SETTLE()
        const after = sample(harness.wrapper)
        expect(after.cards).toBe(before.cards)
        expect(after.bars).toBe(0)
    })
})

describe('T664 · AC-K2：首次进入 / 用户重试 / 筛选变化仍显示 loading（不得靠删 loading 过）', () => {
    it('首次进入（挂起查询）⇒ 每列显示「正在加载任务」', async () => {
        const harness = mountKanban([makeTask({ id: 'k1', state: 'todo' })])
        // 首次进入的查询在飞：必须在挂起期间看到整列 loading（每列一条占位文案）
        const during = sample(harness.wrapper)
        expect(during.loadingText, '首次进入必须可见 loading').toBe(true)
        harness.release()
        await SETTLE()
        expect(sample(harness.wrapper).loadingText).toBe(false)
    })

    it('用户「重试」（整页错误态）⇒ 仍显示 loading', async () => {
        // 首进即失败（无内容可保）⇒ 整页错误态（AC-E4 同族），再点「重试」
        const harness = mountKanban([], { failOnMount: true })
        await SETTLE()
        const retry = harness.wrapper.findAll('button').find((btn) => btn.text().includes('重试'))
        expect(retry, '整页错误态必须提供「重试」').toBeTruthy()

        harness.park()
        harness.setFail(false)
        await retry!.trigger('click')
        await SETTLE()
        expect(sample(harness.wrapper).loadingText, '用户重试必须可见 loading').toBe(true)
        harness.release()
        await SETTLE()
    })

    it('筛选变化（getTasksOptions）⇒ 仍显示 loading', async () => {
        const seed = [makeTask({ id: 'k1', state: 'todo' })]
        const harness = mountKanban(seed)
        await SETTLE()
        expect(sample(harness.wrapper).loadingText).toBe(false)

        harness.park()
        await harness.wrapper.setProps({ getTasksOptions: { state: 'todo' } } as never)
        await SETTLE()
        // 有内容的列：列底加载条；空列：整列「正在加载任务」——两者任一即「用户可见的加载反馈」
        const during = sample(harness.wrapper)
        expect(
            during.loadingText || during.bars > 0,
            '筛选变化必须可见加载反馈（不得靠删 loading 过）'
        ).toBe(true)
        harness.release()
        await SETTLE()
    })
})

describe('T664 · AC-K3：新增任务的本地增量语义不回退', () => {
    it('AddNewTaskId ⇒ 目标列置顶插入，且不触发整板重查', async () => {
        const harness = mountKanban([makeTask({ id: 'k1', state: 'todo' })])
        await SETTLE()
        const before = sample(harness.wrapper)
        const callsBefore = harness.listCalls()

        harness.store.addTask(makeTask({ id: 'k9', state: 'todo' }))
        harness.emit('AddNewTaskId', 'k9')
        await SETTLE()

        const after = sample(harness.wrapper)
        expect(after.cards).toBe(before.cards + 1)
        expect(harness.listCalls(), '新增不得触发重查（R-M/D2 保页）').toBe(callsBefore)
    })
})

/** `task.noTasksInColumn` 的空列占位文案（与 locale 单源） */
export const EMPTY_COLUMN_TEXT = '无待办任务'

// 常量仅作可读性自证（避免与 locale 漂移时静默失效）
void SECTION
void EMPTY_COLUMN_TEXT