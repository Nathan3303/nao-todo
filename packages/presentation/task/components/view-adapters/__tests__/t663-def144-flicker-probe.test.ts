// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { defaultColumns } from '@nao-todo/shared/constants'
import { useSubscriber } from '@nao-todo/shared/hooks'
import { Loading as LoadingComp } from '@nao-todo/shared/components/loading'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '../../../stores'
import TableViewAdapter from '../table-view-adapter/table-view-adapter.vue'
import ListViewAdapter from '../list-view-adapter/list-view-adapter.vue'
import { NUE_COMPONENTS, makeTask } from '../../kanban/__tests__/t608-kanban-harness'

/**
 * `T663` · `DEF-144` **独立复验探针**（QA 自写，不复用 RD 的断言形状）
 *
 * @description 复验对象：`a99a25df`（`silent` 原地刷新）。复现路径与用户所见一致：
 *              `RefreshData`（同步拉取落库后由失效中心派发）⇒ 视图适配器重载 ⇒ 期间采样**用户可见面**。
 *
 * 采样三件（PM 锁定口径 AC-A1）：
 *   ① 是否渲染 loading 分支 —— 直接看 DOM 标记，不只看组件是否存在：
 *      · 表格：`loading-comp` 把 `<task-table-main>` 整块换成加载块（`table.vue` 的 `v-if="loading"`），
 *        此时**行节点全部消失**（断言行数即可捕获），另记 `Loading` 组件 + 文案「正在加载」；
 *      · 列表：`nue-infinite-scroll :loading` 会在行下方**插入** `.nue-infinite-scroll__loading-bar`
 *        （nue-ui 主题 CSS：`padding:1rem; gap:.5rem; display:flex`，内容 1rem 图标 + .875rem 文本
 *        ⇒ 插入即增加约 40~52px 行高，这是「高度抖动」的真实来源）。
 *   ② 列表条目数；
 *   ③ 容器高度 —— jsdom 无布局引擎（`getBoundingClientRect().height` / `scrollHeight` 恒 0），
 *      **像素不可测**。改用**严格更强**的结构判据：全部行 DOM 节点**身份不变**、容器子节点序列不变
 *      ⇒ 无卸载/重建/(loading 条)插入 ⇒ 不可能发生布局跳动。样本里同时打印像素读数如实标注为 0。
 */

const SETTLE = async (): Promise<void> => {
    for (let i = 0; i < 8; i += 1) {
        await nextTick()
        await Promise.resolve()
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
}

/** 只推进微任务 + 一次宏任务：用于「请求在飞」期间采样（不让被挂起的 Promise 完成） */
const TICK = async (): Promise<void> => {
    await nextTick()
    await Promise.resolve()
    await nextTick()
}

/** 列表/表格的行选择器（取自组件模板的**真实**类名，非测试自造）
 *  · 表格：`table-main.vue` 显式 `class="todo-table__main__row"`
 *  · 列表：`list-main.vue` 用 `theme="todo-list-main__row"`，nue-ui 把 theme 展开为
 *    `nue-div--<theme>`（见 `nue-ui/dist/es/component-j_-eF5UZ.js` 的 `t()`），故实际类名带前缀
 */
const ROW_SELECTOR = {
    table: '.todo-table__main__row',
    list: '.nue-div--todo-list-main__row'
} as const

const ROOT_ID = {
    table: 'TasksMainTableContainer',
    list: 'TasksMainListContainer'
} as const

type Sample = {
    /** ① loading 分支：命中的 DOM 标记（空数组 = 未渲染） */
    loadingMarkers: string[]
    /** ② 行数与行节点身份 */
    rows: number
    rowNodes: Element[]
    /** ③ 容器结构 + 像素读数（jsdom 恒 0，如实记录） */
    containerChildren: string[]
    rectHeight: number
    scrollHeight: number
    /** 行文本（内容不变性；用户可见的直接证据） */
    rowTexts: string[]
}

const sampleOf = (wrapper: VueWrapper, view: 'table' | 'list'): Sample => {
    const root = wrapper.find(`#${ROOT_ID[view]}`).element as HTMLElement
    const rowNodes = Array.from(root.querySelectorAll(ROW_SELECTOR[view])) as Element[]
    const loadingMarkers: string[] = []
    if (wrapper.findComponent(LoadingComp).exists()) loadingMarkers.push('loading-comp')
    if (wrapper.find('.nue-infinite-scroll__loading-bar').exists())
        loadingMarkers.push('nue-infinite-scroll__loading-bar')
    if (wrapper.text().includes('正在加载')) loadingMarkers.push('text:正在加载')
    return {
        loadingMarkers,
        rows: rowNodes.length,
        rowNodes,
        containerChildren: Array.from(root.children).map(
            (el) => `${el.tagName.toLowerCase()}.${el.className}`
        ),
        rectHeight: root.getBoundingClientRect().height,
        scrollHeight: root.scrollHeight,
        rowTexts: rowNodes.map((el) => (el.textContent ?? '').trim())
    }
}

type Deferred = {
    promise: Promise<unknown>
    resolve: (value: unknown) => void
}

const makeDeferred = (): Deferred => {
    let resolve: (value: unknown) => void = () => {}
    const promise = new Promise<unknown>((r) => (resolve = r))
    return { promise, resolve }
}

type Harness = {
    wrapper: VueWrapper
    store: ReturnType<typeof useTasksStore>
    emit: (event: string) => void
    /** 下一次（或当前在飞的）`list` 调用挂起 */
    parkNextList: () => Deferred
    listCalls: () => number
    /** 设置下一次 `list` 的返回（默认返回 seed 全量） */
    setResponder: (responder: () => unknown) => void
}

const mountAdapter = (
    view: 'table' | 'list',
    seed: TaskViewObject[],
    options: { responder?: () => unknown } = {}
): Harness => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useTasksStore(pinia)
    store.addTasks(seed.map((task) => ({ ...task })))

    let parked: Deferred | null = null
    let calls = 0
    // 首进即可控（首进失败用例需要在挂载前设定）
    let responder: (() => unknown) | null = options.responder ?? null

    const page = (ids: string[]) => ({
        taskIds: ids,
        pagination: { total: ids.length, page: 1, limit: 20, maxPage: 1 }
    })

    const list = vi.fn(async () => {
        calls += 1
        if (parked) {
            const gate = parked
            parked = null
            await gate.promise
        }
        if (responder) {
            const custom = responder()
            if (custom !== undefined) return custom
        }
        // 生产语义：`taskUseCase.list` 会把实体写回 store（`taskStore.addTasks`）
        const fresh = seed.map((task) => ({ ...task }))
        store.addTasks(fresh)
        return [page(seed.map((task) => task.id)), null]
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
        multiSelectClearSignal: 0,
        taskClicked: vi.fn()
    }

    const wrapper = mount(view === 'table' ? TableViewAdapter : ListViewAdapter, {
        props: props as never,
        global: { plugins: [pinia], components: NUE_COMPONENTS }
    })

    return {
        wrapper,
        store,
        emit: (event: string) => subscriber.emit(event as never),
        parkNextList: () => {
            parked = makeDeferred()
            return parked
        },
        listCalls: () => calls,
        setResponder: (next) => {
            responder = next
        }
    }
}

let mounted: VueWrapper[] = []
afterEach(() => {
    mounted.forEach((wrapper) => wrapper.unmount())
    mounted = []
    document.body.innerHTML = ''
})

describe('T663 / DEF-144 · 自动刷新不得把视图拖回加载态（AC-A1，QA 独立采样）', () => {
    it.each(['table', 'list'] as const)(
        '%s：刷新在飞期间 ①loading 分支 ②行数 ③行/DOM 结构 三者全不变',
        async (view) => {
            const seed = ['t1', 't2', 't3'].map((id) => makeTask({ id, name: `任务-${id}` }))
            const harness = mountAdapter(view, seed)
            mounted.push(harness.wrapper)
            await SETTLE()

            const before = sampleOf(harness.wrapper, view)
            expect(before.loadingMarkers, '前置：首屏加载完，不应残留 loading 分支').toEqual([])
            expect(before.rows).toBe(3)

            // 一轮自动刷新（生产链路：pull 落库 ⇒ RefreshData ⇒ 适配器重载）
            harness.parkNextList()
            harness.emit('RefreshData')
            await TICK()

            const during = sampleOf(harness.wrapper, view)
            console.log(
                `[T663/probeA:${view}] during =`,
                JSON.stringify({
                    markers: during.loadingMarkers,
                    rows: during.rows,
                    rectHeight: during.rectHeight,
                    scrollHeight: during.scrollHeight,
                    children: during.containerChildren
                })
            )

            expect(during.loadingMarkers, '① 刷新在飞期间不得渲染 loading 分支').toEqual([])
            expect(during.rows, '② 刷新在飞期间条目数不得变化').toBe(before.rows)
            // ③ 结构等价：行节点身份与容器子节点序列完全一致 ⇒ 无卸载/重建/插入
            expect(during.rowNodes, '③ 行 DOM 节点身份不得变化（= 无重排）').toEqual(
                before.rowNodes
            )
            expect(during.containerChildren, '③ 容器子节点序列不得变化').toEqual(
                before.containerChildren
            )
            console.log(
                `[T663/probeA:${view}] jsdom 像素读数 =`,
                JSON.stringify({ rectHeight: during.rectHeight, scrollHeight: during.scrollHeight })
            )

            await SETTLE()
            const after = sampleOf(harness.wrapper, view)
            expect(after.loadingMarkers).toEqual([])
            expect(after.rows).toBe(3)
            expect(after.rowNodes, '刷新完成后行节点仍是同一批（无闪烁重建）').toEqual(
                before.rowNodes
            )
        }
    )

    it.each(['table', 'list'] as const)(
        '%s：刷新是**真的**重取了数据（不得用「不刷新」换「不抖」），且视图侧无额外延迟',
        async (view) => {
            const seed = ['t1', 't2'].map((id) => makeTask({ id, name: `旧名-${id}` }))
            const harness = mountAdapter(view, seed)
            mounted.push(harness.wrapper)
            await SETTLE()
            expect(harness.listCalls()).toBe(1)

            // 他端改名：list 返回同 ID、新名字（写入 store 后行文本应更新）
            harness.setResponder(() => {
                const renamed = seed.map((task) => ({ ...task, name: `新名-${task.id}` }))
                harness.store.addTasks(renamed)
                return [
                    {
                        taskIds: renamed.map((t) => t.id),
                        pagination: { total: 2, page: 1, limit: 20, maxPage: 1 }
                    },
                    null
                ]
            })
            const startedAt = performance.now()
            harness.emit('RefreshData')
            await SETTLE()
            const elapsedMs = Math.round((performance.now() - startedAt) * 10) / 10

            expect(harness.listCalls(), '刷新必须真的调用 list 重取').toBe(2)
            const after = sampleOf(harness.wrapper, view)
            console.log(
                `[T663/probeA:${view}] 刷新后行文本 =`,
                JSON.stringify(after.rowTexts),
                '视图侧耗时(ms) =',
                elapsedMs
            )
            expect(after.rowTexts.join('|')).toContain('新名-t1')
            // 视图侧不得引入任何额外等待（30s 周期 + 10s 合并门之外；实测为一次 list 往返 + 渲染）
            expect(elapsedMs, '视图侧刷新不得引入额外等待').toBeLessThan(1000)
        }
    )

    it.each(['table', 'list'] as const)(
        'AC-A3：%s 首次进入（数据确实为空）仍渲染 loading，加载完整百空态',
        async (view) => {
            const pinia = createPinia()
            setActivePinia(pinia)
            const gate = makeDeferred()
            const list = vi.fn(async () => {
                await gate.promise
                return [
                    { taskIds: [], pagination: { total: 0, page: 1, limit: 20, maxPage: 1 } },
                    null
                ]
            })
            const taskUseCase = {
                list,
                update: vi.fn(async () => null),
                delete: vi.fn(async () => null),
                restore: vi.fn(async () => null)
            } as unknown as TaskUseCase
            const wrapper = mount(view === 'table' ? TableViewAdapter : ListViewAdapter, {
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
                    multiSelectClearSignal: 0,
                    taskClicked: vi.fn()
                } as never,
                global: { plugins: [pinia], components: NUE_COMPONENTS }
            })
            mounted.push(wrapper)
            await SETTLE()

            const first = sampleOf(wrapper, view)
            console.log(
                `[T663/probeA3:${view}] 首进（数据未到） =`,
                JSON.stringify({ markers: first.loadingMarkers, rows: first.rows })
            )
            expect(first.loadingMarkers.length, '首次进入必须显示 loading').toBeGreaterThan(0)

            gate.resolve(undefined)
            await SETTLE()
            const settled = sampleOf(wrapper, view)
            expect(settled.loadingMarkers, '加载完必须离开 loading').toEqual([])
            expect(settled.rows).toBe(0)
            expect(wrapper.text(), '空数据须落空态文案').toContain('暂无任务')
        }
    )

    it.each(['table', 'list'] as const)(
        'PM 新增项：%s 的 silent 刷新失败时错误必须可见（不得连错误一起静默）',
        async (view) => {
            const seed = ['t1', 't2'].map((id) => makeTask({ id, name: `任务-${id}` }))
            const harness = mountAdapter(view, seed)
            mounted.push(harness.wrapper)
            await SETTLE()

            // 拉取失败（限流业务码 10051 —— 与 T657 四态一致，错误必须是字符串形态）
            harness.setResponder(() => [null, '10051 请求过于频繁，请稍后再试'])
            harness.emit('RefreshData')
            await SETTLE()

            // 失败可见：在飞期间不闪 loading（静默），失败后错误分支出现
            const failed = sampleOf(harness.wrapper, view)
            console.log(
                `[T663/probeFail:${view}] 失败后 =`,
                JSON.stringify({ markers: failed.loadingMarkers, rows: failed.rows })
            )
            expect(harness.wrapper.text(), '失败必须可见（错误分支/重试按钮）').toMatch(/失败|重试/)
            // 不得卡在加载态（spinner 不能一直转）
            expect(failed.loadingMarkers).toEqual([])
            expect(harness.listCalls()).toBe(2)
        }
    )
})

describe('T663 / AC-B2 · 其它行更新上限 = 30s 周期 + 10s 合并门（≤40s）', () => {
    /** 以源码文本读常量（两个常量分属不同文件，`EVENT_PULL_MERGE_GATE_MS` 未导出） */
    const SYNC_SOURCES = import.meta.glob('/packages/infrastructure/src/persistence-sync/*.ts', {
        query: '?raw',
        import: 'default',
        eager: true
    }) as Record<string, string>

    const numberIn = (fileSuffix: string, name: string): number => {
        const entry = Object.entries(SYNC_SOURCES).find(([path]) => path.endsWith(fileSuffix))
        expect(entry, `源码应存在：${fileSuffix}`).toBeTruthy()
        const match = entry![1].match(new RegExp(`${name}\\s*=\\s*([\\d_]+)`))
        expect(match, `源码应声明常量 ${name}`).toBeTruthy()
        return Number(match![1]!.replace(/_/g, ''))
    }

    it('周期 30s + 事件合并门 10s ⇒ 最坏 40s（本修复未新增任何等待）', () => {
        const interval = numberIn('auto-refresh.ts', 'AUTO_REFRESH_INTERVAL_MS')
        const mergeGate = numberIn('sync-service.ts', 'EVENT_PULL_MERGE_GATE_MS')
        console.log('[T663/probeB2] 周期(ms) =', interval, '合并门(ms) =', mergeGate)
        expect(interval).toBe(30_000)
        expect(mergeGate).toBe(10_000)
        expect(interval + mergeGate, 'AC-B2 上限 40s').toBeLessThanOrEqual(40_000)
    })
})
describe('T663 追加 · DEF-148：原地刷新失败保留内容 + 提示条（列表 / 表格同口径）', () => {
    it.each(['table', 'list'] as const)(
        '%s：失败时内容与行节点保留，提示条可见，且不换错误分支',
        async (view) => {
            const seed = ['t1', 't2', 't3'].map((id) => makeTask({ id, name: `任务-${id}` }))
            const harness = mountAdapter(view, seed)
            mounted.push(harness.wrapper)
            await SETTLE()
            const before = sampleOf(harness.wrapper, view)
            expect(before.rows).toBe(3)

            harness.setResponder(() => [null, '10051 请求过于频繁，请稍后再试'])
            harness.emit('RefreshData')
            await SETTLE()

            const after = sampleOf(harness.wrapper, view)
            const warning = harness.wrapper.find('.task-refresh-warning')
            console.log(
                `[T663/probeFail148:${view}]`,
                JSON.stringify({
                    rows: after.rows,
                    loading: after.loadingMarkers,
                    warn: warning.exists() ? warning.text().slice(0, 24) : '',
                    errorBranch: harness.wrapper.text().includes('加载失败')
                })
            )
            expect(after.rows, '失败时条目数不得归零').toBe(3)
            expect(after.rowNodes, '失败时行 DOM 节点身份不得变化').toEqual(before.rowNodes)
            expect(warning.exists(), '失败必须可见（提示条）').toBe(true)
            expect(warning.text(), '提示条文案应说明「刷新失败」').toMatch(/刷新失败/)
            expect(harness.wrapper.text(), '有内容时不得整块换成错误分支').not.toContain('加载失败')
            expect(after.loadingMarkers, '失败后不得卡在加载态').toEqual([])
        }
    )

    it.each(['table', 'list'] as const)('%s：下一轮成功 ⇒ 提示条消除', async (view) => {
        const seed = ['t1'].map((id) => makeTask({ id, name: `任务-${id}` }))
        const harness = mountAdapter(view, seed)
        mounted.push(harness.wrapper)
        await SETTLE()

        harness.setResponder(() => [null, '10051 请求过于频繁，请稍后再试'])
        harness.emit('RefreshData')
        await SETTLE()
        expect(harness.wrapper.find('.task-refresh-warning').exists()).toBe(true)

        harness.setResponder(() => undefined)
        harness.emit('RefreshData')
        await SETTLE()
        expect(
            harness.wrapper.find('.task-refresh-warning').exists(),
            '成功后提示条必须消失（不残留）'
        ).toBe(false)
        expect(sampleOf(harness.wrapper, view).rows).toBe(1)
    })

    it.each(['table', 'list'] as const)(
        '%s：首进即失败（无内容）⇒ 仍走整页错误分支 + 重试（不得降级成提示条）',
        async (view) => {
            const harness = mountAdapter(view, [], {
                responder: () => [null, '10051 请求过于频繁，请稍后再试']
            })
            mounted.push(harness.wrapper)
            await SETTLE()

            console.log(
                `[T663/probeFail148:${view}:first]`,
                JSON.stringify({
                    errorBranch: harness.wrapper.text().includes('加载失败'),
                    hasRetry: harness.wrapper.text().includes('重试'),
                    warn: harness.wrapper.find('.task-refresh-warning').exists()
                })
            )
            expect(harness.wrapper.text(), '首进失败必须整页错误态').toContain('加载失败')
            expect(harness.wrapper.text()).toContain('重试')
            expect(
                harness.wrapper.find('.task-refresh-warning').exists(),
                '无内容可保时不得只用提示条'
            ).toBe(false)
        }
    )
})