// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { defaultColumns } from '@nao-todo/shared/constants'
import { useSubscriber } from '@nao-todo/shared/hooks'
import { RuleHint } from '@nao-todo/shared/components/rule-hint'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '../../../../stores'
import TableViewAdapter from '../table-view-adapter.vue'
import ListViewAdapter from '../../list-view-adapter/list-view-adapter.vue'
import { NUE_COMPONENTS, makeTask } from '../../../kanban/__tests__/t608-kanban-harness'

/**
 * `T665` · 修 1 —— 空 `reason` **不得**让提示条消失（否则退化成「失败静默」，打破 `DEF-148 / AC-E2`）
 *
 * @description qa `T663` 实测：修前显示判据是**文案真假值**（`v-if="refreshError"`）
 *              ⇒ 底层错误文本为空（或只剩裸业务码）时提示条不渲染 ⇒ 用户看不到任何失败信号。
 *              修后为**两态编码**：`null` = 无失败；`''` = 失败但无可读原因 ⇒ 显示判据 `!== null`，
 *              空原因走兜底句式 `task.refreshFailedGeneric`（⛔ 不得出现 `undefined` / `null` / 裸 `{reason}`）。
 *
 * 用例：① 空串 reason ⇒ 可见 + 文案无占位符残留；①b 裸业务码 ⇒ 同样可见且不外泄内部码；
 *      ② 正常 reason ⇒ 正确插值；③ 非空 → 空 的切换不残留上一条原因。
 */

const SETTLE = async (): Promise<void> => {
    for (let i = 0; i < 8; i += 1) {
        await nextTick()
        await Promise.resolve()
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
}

type Harness = {
    wrapper: VueWrapper
    emit: (event: string) => void
    setError: (err: string) => void
}

const mountAdapter = (view: 'table' | 'list', seed: TaskViewObject[]): Harness => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useTasksStore(pinia)
    store.addTasks(seed.map((task) => ({ ...task })))
    let failure: string | null = null
    const list = vi.fn(async () => {
        if (failure !== null) return [null, failure]
        store.addTasks(seed.map((task) => ({ ...task })))
        return [
            {
                taskIds: seed.map((task) => task.id),
                pagination: { total: seed.length, page: 1, limit: 20, maxPage: 1 }
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
        emit: (event) => subscriber.emit(event as never),
        setError: (err) => {
            failure = err
        }
    }
}

const stripText = (wrapper: VueWrapper): string | null => {
    const strip = wrapper.findComponent(RuleHint)
    return strip.exists() ? strip.text() : null
}

let mounted: VueWrapper[] = []
afterEach(() => {
    mounted.forEach((wrapper) => wrapper.unmount())
    mounted = []
    document.body.innerHTML = ''
})

describe.each<['table' | 'list']>([['table'], ['list']])(
    'T665 修 1 · %s 视图：空原因也必须可见',
    (view) => {
        const boot = async () => {
            const harness = mountAdapter(view, [makeTask({ id: 't1', name: '任务1' })])
            mounted.push(harness.wrapper)
            await SETTLE()
            expect(stripText(harness.wrapper), '刷新前无提示条').toBeNull()
            return harness
        }

        it('① 空串 reason ⇒ 提示条可见 + 文案无 undefined/null/{reason} 残留', async () => {
            const harness = await boot()
            harness.setError('')
            harness.emit('RefreshData')
            await SETTLE()

            const text = stripText(harness.wrapper)
            expect(text, '空原因不得让提示条消失（否则失败静默）').not.toBeNull()
            expect(text).toContain('刷新失败')
            expect(text).not.toContain('undefined')
            expect(text).not.toContain('null')
            expect(text).not.toContain('{reason}')
        })

        it('①b 裸业务码（10051）⇒ 同样可见，且不外泄内部码', async () => {
            const harness = await boot()
            harness.setError('10051')
            harness.emit('RefreshData')
            await SETTLE()

            const text = stripText(harness.wrapper)
            expect(text).not.toBeNull()
            expect(text, '裸业务码不是用户可读文案，不得出现在提示条').not.toContain('10051')
            expect(text).toContain('刷新失败')
        })

        it('② 正常 reason ⇒ 正确插值（含原因文本）', async () => {
            const harness = await boot()
            harness.setError('网络错误，请检查网络连接')
            harness.emit('RefreshData')
            await SETTLE()

            const text = stripText(harness.wrapper)
            expect(text).not.toBeNull()
            expect(text).toContain('刷新失败')
            expect(text, '可读原因必须插值进文案').toContain('网络错误，请检查网络连接')
        })

        it('③ 非空 → 空 的切换不残留上一条原因', async () => {
            const harness = await boot()
            harness.setError('限流：请求过于频繁')
            harness.emit('RefreshData')
            await SETTLE()
            expect(stripText(harness.wrapper)).toContain('限流：请求过于频繁')

            harness.setError('')
            harness.emit('RefreshData')
            await SETTLE()
            const text = stripText(harness.wrapper)
            expect(text).not.toBeNull()
            expect(text, '切换到空原因后不得残留旧原因').not.toContain('限流：请求过于频繁')
            expect(text).toContain('刷新失败')
        })

        it('成功一轮 ⇒ 提示条消失（不残留）', async () => {
            const harness = await boot()
            harness.setError('')
            harness.emit('RefreshData')
            await SETTLE()
            expect(stripText(harness.wrapper)).not.toBeNull()

            harness.setError(null as unknown as string)
            // 恢复成功：把失败开关关掉（null 表示不失败）
            ;(harness as unknown as { setError: (e: string | null) => void }).setError(null)
            harness.emit('RefreshData')
            await SETTLE()
            expect(stripText(harness.wrapper)).toBeNull()
        })
    }
)