// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import { defaultColumns } from '@nao-todo/shared/constants'
import { useSubscriber } from '@nao-todo/shared/hooks'
import { RuleHint } from '@nao-todo/shared/components/rule-hint'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '../../../../stores'
import KanbanViewAdapter from '../kanban-view-adapter.vue'
import { KANBAN_GROUP_BY_KEY } from '../../../kanban/use-kanban-group'
import { NUE_COMPONENTS, makeTask } from '../../../kanban/__tests__/t608-kanban-harness'

/**
 * `T664` / `DEF-148` 看板落点 —— 原地刷新失败**保留卡片** + 非破坏性提示条
 *
 * @description 列内 `silent` 失败且**有卡片** ⇒ 只上报 `firstRefreshError`（外层提示条）；
 *              列内卡片与列错误分支均不变化。无卡片的列（无内容可保）仍走既有列内错误分支。
 */

const SETTLE = async (): Promise<void> => {
    for (let i = 0; i < 8; i += 1) {
        await nextTick()
        await Promise.resolve()
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
}

let mounted: VueWrapper[] = []
afterEach(() => {
    mounted.forEach((wrapper) => wrapper.unmount())
    mounted = []
    document.body.innerHTML = ''
})

describe('T664 / DEF-148 · 看板刷新失败保留卡片', () => {
    it('有卡片 + 刷新失败 ⇒ 卡片保留、提示条可见、不换列内错误分支', async () => {
        const pinia = createPinia()
        setActivePinia(pinia)
        const taskUseCase = {
            list: vi.fn(async () => [null, '10051']),
            update: vi.fn(async () => null),
            delete: vi.fn(async () => null),
            restore: vi.fn(async () => null)
        } as unknown as TaskUseCase
        const seed: TaskViewObject[] = [makeTask({ id: 'k1', state: 'todo' })]
        const store = useTasksStore(pinia)
        store.addTasks(seed.map((task) => ({ ...task })))

        const subscriber = useSubscriber()
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
                provide: { [KANBAN_GROUP_BY_KEY as symbol]: ref('state') }
            }
        })
        mounted.push(wrapper)
        await SETTLE()

        // 首进即失败（无内容可保）⇒ 既有整页错误态（AC-E4 同族）
        expect(wrapper.text()).toContain('加载失败，请稍后重试')

        // 恢复成功后点「重试」进入有内容状态（新一轮加载可见）
        const listOk = vi.fn(async () => [
            {
                taskIds: ['k1'],
                pagination: { total: 1, page: 1, limit: 20, maxPage: 1 }
            },
            null
        ])
        ;(taskUseCase.list as unknown as ReturnType<typeof vi.fn>).mockImplementation(listOk)
        const retry = wrapper.findAll('button').find((btn) => btn.text().includes('重试'))
        expect(retry, '整页错误态必须提供「重试」').toBeTruthy()
        await retry!.trigger('click')
        await SETTLE()
        const cardsBefore = wrapper.findAll('[data-taskid]').map((node) => node.element)
        expect(cardsBefore.length).toBeGreaterThan(0)

        ;(taskUseCase.list as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => [
            null,
            '10051'
        ])
        subscriber.emit('RefreshData' as never)
        await SETTLE()

        const cardsAfter = wrapper.findAll('[data-taskid]').map((node) => node.element)
        expect(cardsAfter, 'AC-E1：卡片与 DOM 身份必须保留').toEqual(cardsBefore)
        const strip = wrapper.findComponent(RuleHint)
        expect(strip.exists(), 'AC-E2：失败必须可见').toBe(true)
        expect(strip.attributes('data-variant')).toBe('error')
        expect(strip.text()).toContain('刷新失败')

        // AC-E3：下一轮成功 ⇒ 提示条消失
        ;(taskUseCase.list as unknown as ReturnType<typeof vi.fn>).mockImplementation(listOk)
        subscriber.emit('RefreshData' as never)
        await SETTLE()
        expect(wrapper.findComponent(RuleHint).exists()).toBe(false)
        expect(wrapper.findAll('[data-taskid]').length).toBe(cardsBefore.length)
    })
})