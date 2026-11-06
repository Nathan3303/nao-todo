// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { defaultColumns } from '@nao-todo/shared/constants'
import { useSubscriber } from '@nao-todo/shared/hooks'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { Loading as LoadingComp } from '@nao-todo/shared/components/loading'
import { useTasksStore } from '../../../../stores'
import TableViewAdapter from '../table-view-adapter.vue'
import ListViewAdapter from '../../list-view-adapter/list-view-adapter.vue'
import { NUE_COMPONENTS, makeTask } from '../../../kanban/__tests__/t608-kanban-harness'

/**
 * `T662` / `DEF-144` —— 自动刷新重载**不得**把视图拖回加载态（AC-A1 / AC-A3）
 *
 * @description 复现路径（生产链路）：自动拉取落库 ⇒ `notifyDataChanged()` ⇒
 *              `nao-todo:data-changed` ⇒ 应用级失效中心 ⇒ `RefreshData` ⇒
 *              视图适配器 `taskLoader.loadAndReplace()`。
 *              **红基线根因**：`useTasksLoader.load()` 无条件 `states.loading = true`
 *              ⇒ 表格的 `<loading-comp v-if="loading">` / 列表的 `nue-infinite-scroll :loading`
 *              在每次刷新都把已有内容换成加载态（「突然变加载又变回去」）。
 *
 * 断言口径（AC-A1）：刷新**在飞期间**采样三件事，三者必须不变
 *   ① 是否渲染 loading 分支；② 列表条目数；③ 容器根节点仍是同一个 DOM 节点（jsdom 无布局引擎，
 *   以「同一节点未卸载/重建」作为「高度不跳变」的结构代理）。
 *
 * 红基线（修前）：① 为真、② 归零（表格 loading 分支替换了行）。
 */

const SETTLE = async (): Promise<void> => {
    for (let i = 0; i < 8; i += 1) {
        await nextTick()
        await Promise.resolve()
        // loader 的 `disabled` 复位走 `setTimeout(delay)`（delay 默认 0）⇒ 必须放行宏任务
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
}

type Deferred = {
    promise: Promise<{ taskIds: string[]; pagination: Record<string, number> }>
    resolve: (value: { taskIds: string[]; pagination: Record<string, number> }) => void
}

const makeDeferred = (): Deferred => {
    let resolve: Deferred['resolve'] = () => {}
    const promise = new Promise<{ taskIds: string[]; pagination: Record<string, number> }>(
        (r) => (resolve = r)
    )
    return { promise, resolve }
}

type Harness = {
    wrapper: VueWrapper
    rows: TaskViewObject[]
    emit: (event: string) => void
    /** 下一次 list 调用挂起（用于「刷新在飞期间」采样） */
    deferNextList: () => Deferred
    listCalls: () => number
}

const mountAdapter = (view: 'table' | 'list', seed: TaskViewObject[]): Harness => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useTasksStore(pinia)
    store.addTasks(seed.map((task) => ({ ...task })))

    let deferred: Deferred | null = null
    let calls = 0
    const list = vi.fn(async (options: { page?: number; limit?: number }) => {
        calls += 1
        const ids = seed.map((task) => task.id)
        const payload = {
            taskIds: ids,
            pagination: { total: seed.length, page: options.page ?? 1, limit: 20, maxPage: 1 }
        }
        if (deferred) {
            const pending = deferred
            deferred = null
            await pending.promise
        }
        // 生产语义：list 会把实体写回 store（`taskUseCase.list` → `taskStore.addTasks`）
        store.addTasks(seed.map((task) => ({ ...task })))
        return [payload, null]
    })
    const taskUseCase = {
        list,
        update: vi.fn(async () => null),
        delete: vi.fn(async () => null),
        restore: vi.fn(async () => null)
    } as unknown as TaskUseCase

    const subscriber = useSubscriber()
    const props = {
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
    }

    const wrapper = mount(view === 'table' ? TableViewAdapter : ListViewAdapter, {
        props: props as never,
        global: { plugins: [pinia], components: NUE_COMPONENTS }
    })

    return {
        wrapper,
        rows: seed,
        emit: (event: string) => subscriber.emit(event as never),
        deferNextList: () => {
            deferred = makeDeferred()
            return deferred
        },
        listCalls: () => calls
    }
}

let mounted: VueWrapper[] = []
afterEach(() => {
    mounted.forEach((wrapper) => wrapper.unmount())
    mounted = []
    document.body.innerHTML = ''
})

const ROW_SELECTOR = {
    table: '.todo-table__main__row',
    list: '[data-done]'
} as const

const snapshot = (harness: Harness, view: 'table' | 'list') => ({
    loading: harness.wrapper.findComponent(LoadingComp).exists(),
    rows: harness.wrapper.findAll(ROW_SELECTOR[view]).length,
    root: harness.wrapper.find(
        `#${view === 'table' ? 'TasksMainTableContainer' : 'TasksMainListContainer'}`
    ).element
})

describe('T662 / DEF-144 · 自动刷新重载不抖（AC-A1）', () => {
    it('表格视图：刷新在飞期间不渲染 loading、行数不变、根节点不重建', async () => {
        const seed = ['t1', 't2', 't3'].map((id) => makeTask({ id, name: `任务${id}` }))
        const harness = mountAdapter('table', seed)
        mounted.push(harness.wrapper)
        await SETTLE()

        const before = snapshot(harness, 'table')
        expect(before.loading).toBe(false)
        expect(before.rows).toBe(3)
        expect(before.root).toBeTruthy()

        // 自动刷新 ⇒ RefreshData（生产链路：pull 落库 → data-changed → hub → RefreshData）
        const deferred = harness.deferNextList()
        harness.emit('RefreshData')
        await SETTLE()

        const during = snapshot(harness, 'table')
        console.log(
            '[probeA] listCalls =',
            harness.listCalls(),
            'during =',
            JSON.stringify({ loading: during.loading, rows: during.rows })
        )
        expect(during.loading, '刷新在飞期间不得渲染 loading 分支').toBe(false)
        expect(during.rows, '刷新在飞期间条目数不得变化').toBe(before.rows)
        expect(during.root, '刷新在飞期间容器根节点不得重建（高度不跳变的结构代理）').toBe(
            before.root
        )

        deferred.resolve({
            taskIds: seed.map((task) => task.id),
            pagination: { total: 3, page: 1, limit: 20, maxPage: 1 }
        })
        await SETTLE()

        const after = snapshot(harness, 'table')
        expect(after.rows).toBe(3)
        expect(after.root).toBe(before.root)
    })

    it('列表视图：刷新在飞期间不渲染 loading、行数不变', async () => {
        const seed = ['t1', 't2'].map((id) => makeTask({ id, name: `任务${id}` }))
        const harness = mountAdapter('list', seed)
        mounted.push(harness.wrapper)
        await SETTLE()

        const before = snapshot(harness, 'list')
        expect(before.loading).toBe(false)

        const deferred = harness.deferNextList()
        harness.emit('RefreshData')
        await SETTLE()

        const during = snapshot(harness, 'list')
        expect(during.loading, '刷新在飞期间不得渲染 loading 分支').toBe(false)
        expect(during.rows, '刷新在飞期间条目数不得变化').toBe(before.rows)

        deferred.resolve({
            taskIds: seed.map((task) => task.id),
            pagination: { total: 2, page: 1, limit: 20, maxPage: 1 }
        })
        await SETTLE()
        expect(snapshot(harness, 'list').rows).toBe(before.rows)
    })

    it('AC-A3：首次进入（确实无数据）仍渲染 loading，加载完落空态（不得「永不显示 loading」）', async () => {
        const pinia = createPinia()
        setActivePinia(pinia)
        let deferred = makeDeferred()
        const taskUseCase = {
            list: vi.fn(async () => {
                await deferred.promise
                return [
                    { taskIds: [], pagination: { total: 0, page: 1, limit: 20, maxPage: 1 } },
                    null
                ]
            }),
            update: vi.fn(async () => null),
            delete: vi.fn(async () => null),
            restore: vi.fn(async () => null)
        } as unknown as TaskUseCase
        const wrapper = mount(TableViewAdapter, {
            props: {
                taskUseCase,
                getTasksOptions: {},
                subscriber: useSubscriber(),
                dialogManager: { open: vi.fn(), close: vi.fn() },
                tags: [],
                columns: { ...defaultColumns },
                getNoTaskError: () => ({
                    message: '暂无任务',
                    image: '',
                    isShowTaskCreateButton: false
                }),
                getColumnLabel: (key: string) => key,
                getProjectName: () => '',
                showTaskDetails: vi.fn(),
                updateColumns: vi.fn(),
                updateSortOptions: vi.fn(),
                clearSortOptions: vi.fn(),
                multiSelectClearSignal: 0
            } as never,
            global: { plugins: [pinia], components: NUE_COMPONENTS }
        })
        mounted.push(wrapper)
        await SETTLE()

        // 首次进入：数据未到 ⇒ 必须显示 loading（adapterLoading）
        expect(wrapper.findComponent(LoadingComp).exists(), '首次进入必须显示 loading').toBe(true)

        deferred.resolve({
            taskIds: [],
            pagination: { total: 0, page: 1, limit: 20, maxPage: 1 }
        })
        await SETTLE()
        expect(wrapper.findComponent(LoadingComp).exists()).toBe(false)

        // 刷新时第二轮：空列表也必须落到（空态/内容），不得因「静默刷新」而卡在 loading
        deferred = makeDeferred()
        useSubscriber().emit('RefreshData')
        await SETTLE()
        expect(wrapper.findComponent(LoadingComp).exists()).toBe(false)
        deferred.resolve({
            taskIds: [],
            pagination: { total: 0, page: 1, limit: 20, maxPage: 1 }
        })
        await SETTLE()
        expect(wrapper.findComponent(LoadingComp).exists()).toBe(false)
    })
})