// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { defaultColumns } from '@nao-todo/shared/constants'
import { useSubscriber } from '@nao-todo/shared/hooks'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '../../../../stores'
import KanbanViewAdapter from '../kanban-view-adapter.vue'
import { NUE_COMPONENTS, makeTask } from '../../../kanban/__tests__/t608-kanban-harness'

/**
 * `T663` 追加复验 · `DEF-144` 看板落点 + `DEF-148` + 「重试死路」（`T664` 提交 `585c3f00` / `66daf286`）
 *
 * @description 真实挂载 `kanban-view-adapter.vue`（→ 真 `TaskKanban` → 真列组件）；`list` 用可控桩
 *              （可挂起 / 可失败 / 可切换数据），数据写回真 pinia store（生产 `list → addTasks` 语义）。
 *              断言面全部落在用户可见 DOM：列底加载条、空列占位、卡片节点身份、提示条、整页错误/重试。
 *              口径同 `AC-A1`：jsdom 无布局 ⇒ 用「卡片 DOM 节点身份不变」代替「像素高度不变」。
 */

const SETTLE = async (): Promise<void> => {
    for (let i = 0; i < 8; i += 1) {
        await nextTick()
        await Promise.resolve()
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
}

/** 只推进渲染 + 微任务（用于「请求在飞」期间采样） */
const TICK = async (): Promise<void> => {
    await nextTick()
    await Promise.resolve()
    await nextTick()
}

type Deferred = { promise: Promise<void>; release: () => void }
const makeDeferred = (): Deferred => {
    let release: () => void = () => {}
    const promise = new Promise<void>((r) => (release = () => r()))
    return { promise, release }
}

type Mode = 'ok' | 'fail'

type Harness = {
    wrapper: VueWrapper
    store: ReturnType<typeof useTasksStore>
    emit: (event: string) => void
    setMode: (mode: Mode) => void
    parkNext: () => Deferred
    setSeed: (tasks: TaskViewObject[]) => void
    listCalls: () => number
}

const mountKanban = (
    seed: TaskViewObject[],
    options: { mode?: Mode; parkInitial?: boolean } = {}
): Harness => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useTasksStore(pinia)
    store.addTasks(seed.map((t) => ({ ...t })))

    let mode: Mode = options.mode ?? 'ok'
    // 首进即挂起（在挂载前设置，才能采到「首屏请求在飞」的真实形态）
    let parked: Deferred | null = options.parkInitial ? makeDeferred() : null
    let current = seed
    let calls = 0

    const list = vi.fn(async (options: { state?: string } = {}) => {
        calls += 1
        if (parked) {
            const gate = parked
            parked = null
            await gate.promise
        }
        if (mode === 'fail') return [null, '10051 请求过于频繁，请稍后再试']
        const matched = current.filter((t) => !options.state || t.state === options.state)
        store.addTasks(matched.map((t) => ({ ...t })))
        return [
            {
                taskIds: matched.map((t) => t.id),
                pagination: { total: matched.length, page: 1, limit: 20, maxPage: 1 }
            },
            null
        ]
    })

    const taskUseCase = {
        list,
        update: vi.fn(async () => null),
        delete: vi.fn(async () => null),
        restore: vi.fn(async () => null),
        create: vi.fn(async () => null),
        resort: vi.fn(async () => null)
    } as unknown as TaskUseCase

    const subscriber = useSubscriber()
    const wrapper = mount(KanbanViewAdapter, {
        attachTo: document.body,
        props: {
            taskUseCase,
            getTasksOptions: {},
            subscriber,
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
        global: {
            components: NUE_COMPONENTS,
            mocks: { $route: { params: {} } }
        }
    })

    return {
        wrapper,
        store,
        emit: (event: string) => subscriber.emit(event as never),
        setMode: (next) => (mode = next),
        parkNext: () => (parked = makeDeferred()),
        setSeed: (tasks) => (current = tasks),
        listCalls: () => calls
    }
}

let mounted: VueWrapper[] = []
afterEach(() => {
    mounted.forEach((w) => w.unmount())
    mounted = []
    document.body.innerHTML = ''
})

const cards = (wrapper: VueWrapper): Element[] =>
    Array.from(wrapper.element.querySelectorAll('[data-taskid]'))
const bars = (wrapper: VueWrapper): number =>
    wrapper.findAll('.nue-infinite-scroll__loading-bar').length
const placeholders = (wrapper: VueWrapper): number =>
    wrapper.text().split('正在加载任务').length - 1
const warn = (wrapper: VueWrapper): string =>
    wrapper.find('.task-refresh-warning').exists()
        ? wrapper.find('.task-refresh-warning').text()
        : ''

describe('T663 追加 · DEF-144 看板：自动刷新原地进行（AC-K1）', () => {
    it('刷新在飞期间：不插列底加载条、空列不换「正在加载任务」、卡片节点身份不变', async () => {
        const seed = [makeTask({ id: 'k1', name: '待办A', state: 'todo' })]
        const harness = mountKanban(seed)
        mounted.push(harness.wrapper)
        await SETTLE()

        const before = { cards: cards(harness.wrapper), bars: bars(harness.wrapper) }
        expect(before.cards.length, '前置：有 1 张卡片').toBe(1)

        harness.parkNext()
        harness.emit('RefreshData')
        await TICK()

        const during = {
            cards: cards(harness.wrapper),
            bars: bars(harness.wrapper),
            placeholders: placeholders(harness.wrapper)
        }
        console.log(
            '[T663/probeK:during]',
            JSON.stringify({
                cards: during.cards.length,
                bars: during.bars,
                placeholders: during.placeholders
            })
        )
        expect(during.bars, '列底不得插入加载条').toBe(0)
        expect(during.placeholders, '空列不得换成「正在加载任务」').toBe(0)
        expect(during.cards, '卡片 DOM 节点身份不得变化').toEqual(before.cards)

        await SETTLE()
        expect(bars(harness.wrapper)).toBe(0)
    })

    it('AC-K2：首进仍显示 loading（不得为了不抖而永不显示加载）', async () => {
        const seed = [makeTask({ id: 'k1', name: '待办A', state: 'todo' })]
        const harness = mountKanban(seed)
        mounted.push(harness.wrapper)
        console.log(
            '[T663/probeK:first]',
            JSON.stringify({ placeholders: placeholders(harness.wrapper) })
        )
        expect(placeholders(harness.wrapper), '首进必须显示列内加载占位').toBeGreaterThan(0)
        await SETTLE()
    })

    it('刷新确实带来新内容（不得用「不刷新」换「不抖」）', async () => {
        const seed = [makeTask({ id: 'k1', name: '旧名', state: 'todo' })]
        const harness = mountKanban(seed)
        mounted.push(harness.wrapper)
        await SETTLE()
        expect(harness.wrapper.text()).toContain('旧名')

        harness.setSeed([makeTask({ id: 'k1', name: '新名', state: 'todo' })])
        harness.emit('RefreshData')
        await SETTLE()
        console.log(
            '[T663/probeK:update]',
            JSON.stringify({ text: harness.wrapper.text().slice(0, 40) })
        )
        expect(harness.wrapper.text(), '刷新后卡片文本应更新').toContain('新名')
    })
})

describe('T663 追加 · DEF-148 看板：刷新失败保留卡片 + 提示条（不换错误分支）', () => {
    it('静默刷新失败：卡片与身份保留、提示条可见、不出现整页错误', async () => {
        const seed = [
            makeTask({ id: 'k1', name: '待办A', state: 'todo' }),
            makeTask({ id: 'k2', name: '已完成B', state: 'done' })
        ]
        const harness = mountKanban(seed)
        mounted.push(harness.wrapper)
        await SETTLE()
        const before = cards(harness.wrapper)
        expect(before.length).toBe(2)

        harness.setMode('fail')
        harness.emit('RefreshData')
        await SETTLE()

        const after = cards(harness.wrapper)
        console.log(
            '[T663/probeK:fail]',
            JSON.stringify({
                cards: after.length,
                warn: warn(harness.wrapper).slice(0, 40),
                hasRetry: harness.wrapper.text().includes('重试')
            })
        )
        expect(after.length, '失败时卡片不得消失').toBe(2)
        expect(after, '失败时卡片 DOM 节点身份不得变化').toEqual(before)
        expect(warn(harness.wrapper), '失败必须可见（提示条）').toMatch(/刷新失败/)
        expect(harness.wrapper.text(), '不得整页换成错误分支').not.toContain('加载失败，请稍后重试')
    })

    it('下一轮成功 ⇒ 提示条消除（不残留、不刷屏）', async () => {
        const seed = [makeTask({ id: 'k1', name: '待办A', state: 'todo' })]
        const harness = mountKanban(seed)
        mounted.push(harness.wrapper)
        await SETTLE()

        harness.setMode('fail')
        harness.emit('RefreshData')
        await SETTLE()
        expect(warn(harness.wrapper)).toMatch(/刷新失败/)

        harness.setMode('ok')
        harness.emit('RefreshData')
        await SETTLE()
        expect(warn(harness.wrapper), '成功后提示条必须消失').toBe('')
        expect(cards(harness.wrapper).length).toBe(1)
    })

    it('首进即失败（无内容）⇒ 仍走既有整页错误分支（不得降级成提示条）', async () => {
        const harness = mountKanban([], { mode: 'fail' })
        mounted.push(harness.wrapper)
        await SETTLE()

        console.log(
            '[T663/probeK:firstfail]',
            JSON.stringify({
                hasError: harness.wrapper.text().includes('加载失败，请稍后重试'),
                warn: warn(harness.wrapper).slice(0, 20)
            })
        )
        expect(harness.wrapper.text(), '首进即失败必须是整页错误态').toContain(
            '加载失败，请稍后重试'
        )
        expect(warn(harness.wrapper), '无内容可保时不得只用提示条').toBe('')
    })
})

describe('T663 追加 · 新增 A：「整页错误态点重试」不得是死路', () => {
    it('重试 → 看板重新挂载并可见 loading → 成功恢复卡片', async () => {
        const seed = [makeTask({ id: 'k1', name: '待办A', state: 'todo' })]
        const harness = mountKanban(seed, { mode: 'fail' })
        mounted.push(harness.wrapper)
        await SETTLE()
        expect(harness.wrapper.text(), '前置：整页错误态').toContain('加载失败，请稍后重试')
        const callsInError = harness.listCalls()

        // 服务端恢复；用户点「重试」⇒ 必须看到加载反馈（不得「点了没反应」）
        harness.setMode('ok')
        const gate = harness.parkNext()
        const retryButton = harness.wrapper
            .findAll('button')
            .find((b) => (b.text() ?? '').includes('重试'))
        expect(retryButton, '错误态应有「重试」按钮').toBeTruthy()
        await retryButton!.trigger('click')
        await TICK()

        const during = {
            placeholders: placeholders(harness.wrapper),
            hasError: harness.wrapper.text().includes('加载失败，请稍后重试'),
            calls: harness.listCalls()
        }
        console.log('[T663/probeK:retry]', JSON.stringify(during))
        expect(during.hasError, '重试后应离开错误态').toBe(false)
        expect(during.calls, '重试必须真的重新发起请求').toBeGreaterThan(callsInError)
        expect(during.placeholders, '重试必须给出可见加载反馈').toBeGreaterThan(0)

        gate.release()
        await SETTLE()
        expect(cards(harness.wrapper).length, '重试成功后卡片恢复').toBe(1)
    })
})