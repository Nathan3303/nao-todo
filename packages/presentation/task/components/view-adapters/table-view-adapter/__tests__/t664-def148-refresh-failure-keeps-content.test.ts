// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { defaultColumns } from '@nao-todo/shared/constants'
import { useSubscriber } from '@nao-todo/shared/hooks'
import { Loading as LoadingComp } from '@nao-todo/shared/components/loading'
import { RuleHint } from '@nao-todo/shared/components/rule-hint'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '../../../../stores'
import TableViewAdapter from '../table-view-adapter.vue'
import ListViewAdapter from '../../list-view-adapter/list-view-adapter.vue'
import { NUE_COMPONENTS, makeTask } from '../../../kanban/__tests__/t608-kanban-harness'

/**
 * `T664` / `DEF-148` —— 原地刷新失败**不得**清空内容（表格 / 列表，AC-E1…E4）
 *
 * @description 修前（qa `T663` 实测）：`silent` 刷新失败 ⇒ 列表命中错误分支 ⇒ 表格 `rows=0`，
 *              内容整块消失，下轮成功才恢复 ⇒ 自动刷新 30s 一次 ⇒「内容 ⇄ 错误」反复切。
 *              修后：失败 ⇒ **内容与行 DOM 保留** + 既有 `RuleHint(variant=error)` 提示条（非破坏性、
 *              不新增自绘错误态）+ 下轮成功自动消除；无内容（首进即失败）仍落既有错误分支。
 */

const SETTLE = async (): Promise<void> => {
    for (let i = 0; i < 8; i += 1) {
        await nextTick()
        await Promise.resolve()
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
}

const ROW_SELECTOR = {
    table: '.todo-table__main__row',
    list: '.nue-div--todo-list-main__row'
} as const

const ROOT_ID = { table: 'TasksMainTableContainer', list: 'TasksMainListContainer' } as const

type Harness = {
    wrapper: VueWrapper
    store: ReturnType<typeof useTasksStore>
    emit: (event: string) => void
    setFail: (fail: boolean) => void
    setIds: (ids: string[]) => void
}

const mountAdapter = (
    view: 'table' | 'list',
    seed: TaskViewObject[],
    options: { failOnMount?: boolean } = {}
): Harness => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useTasksStore(pinia)
    store.addTasks(seed.map((task) => ({ ...task })))

    let fail = options.failOnMount === true
    let ids = seed.map((task) => task.id)
    const list = vi.fn(async () => {
        if (fail) return [null, '10051']
        store.addTasks(seed.map((task) => ({ ...task })))
        return [
            {
                taskIds: [...ids],
                pagination: { total: ids.length, page: 1, limit: 20, maxPage: 1 }
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
    const wrapper = mount(view === 'table' ? TableViewAdapter : ListViewAdapter, {
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
        global: { plugins: [pinia], components: NUE_COMPONENTS }
    })
    return {
        wrapper,
        store,
        emit: (event) => subscriber.emit(event as never),
        setFail: (next) => {
            fail = next
        },
        setIds: (next) => {
            ids = next
        }
    }
}

let mounted: VueWrapper[] = []
afterEach(() => {
    mounted.forEach((wrapper) => wrapper.unmount())
    mounted = []
    document.body.innerHTML = ''
})

const rows = (harness: Harness, view: 'table' | 'list'): Element[] =>
    harness.wrapper.findAll(ROW_SELECTOR[view]).map((wrapper) => wrapper.element)

describe.each<['table' | 'list', number]>([
    ['table', 3],
    ['list', 3]
])('T664 / DEF-148 · %s 视图：刷新失败保留内容', (view) => {
    it('AC-E1/E2：内容与行 DOM 身份不变，失败以提示条可见（不换错误分支）', async () => {
        const seed = ['t1', 't2', 't3'].map((id) => makeTask({ id, name: `任务${id}` }))
        const harness = mountAdapter(view, seed)
        mounted.push(harness.wrapper)
        await SETTLE()

        const before = rows(harness, view)
        expect(before).toHaveLength(3)
        expect(harness.wrapper.findComponent(RuleHint).exists(), '刷新前不应有提示条').toBe(false)

        harness.setFail(true)
        harness.emit('RefreshData')
        await SETTLE()

        const during = rows(harness, view)
        expect(during, 'AC-E1：条目数不变').toHaveLength(3)
        during.forEach((element, index) => {
            expect(element, `AC-E1：第 ${index + 1} 行 DOM 身份不变`).toBe(before[index])
        })
        expect(
            harness.wrapper.findComponent(LoadingComp).exists(),
            'AC-E1：不得落 loading 分支'
        ).toBe(false)
        const strip = harness.wrapper.findComponent(RuleHint)
        expect(strip.exists(), 'AC-E2：失败必须可见（非阻塞提示条）').toBe(true)
        expect(strip.attributes('data-variant'), '提示条必须用既有 error 变体').toBe('error')
        expect(strip.text(), '提示条文案必须说明失败原因').toContain('刷新失败')
        expect(
            harness.wrapper.find(`#${ROOT_ID[view]}`).text(),
            '不得渲染整块错误态（无「加载失败，请稍后重试」+ 重试按钮）'
        ).not.toContain('加载失败，请稍后重试')
    })

    it('AC-E3：下轮成功 ⇒ 提示条消失、数据收敛（不残留、不刷屏）', async () => {
        const seed = ['t1'].map((id) => makeTask({ id, name: `任务${id}` }))
        const harness = mountAdapter(view, seed)
        mounted.push(harness.wrapper)
        await SETTLE()

        harness.setFail(true)
        harness.emit('RefreshData')
        await SETTLE()
        expect(harness.wrapper.findComponent(RuleHint).exists()).toBe(true)

        harness.setFail(false)
        harness.emit('RefreshData')
        await SETTLE()
        expect(harness.wrapper.findComponent(RuleHint).exists(), '成功必须清除提示条').toBe(false)
        expect(rows(harness, view)).toHaveLength(1)
    })

    it('AC-E4：首进即失败（无内容可保）仍落既有错误态 + 重试入口', async () => {
        const harness = mountAdapter(view, [], { failOnMount: true })
        mounted.push(harness.wrapper)
        await SETTLE()
        expect(harness.wrapper.findComponent(RuleHint).exists(), '无内容时不用提示条').toBe(false)
        expect(
            harness.wrapper.text(),
            'AC-E4：首进失败必须仍是正常错误态（可见错误 + 重试）'
        ).toContain('加载失败，请稍后重试')
        expect(rows(harness, view)).toHaveLength(0)
    })
})