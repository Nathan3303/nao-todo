// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { defaultColumns } from '@nao-todo/shared/constants'
import { useSubscriber } from '@nao-todo/shared/hooks'
import { setLocale } from '@nao-todo/shared/locales'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '../../../stores'
import ListViewAdapter from '../list-view-adapter/list-view-adapter.vue'
import { NUE_COMPONENTS, makeTask } from '../../kanban/__tests__/t608-kanban-harness'

/**
 * `T663` 末轮 · `DEF-150`（空原因必须**可见** + 兜底句式）+ 裸业务码清洗（`T665` / `87b669e4`）
 *
 * @description 真实挂载列表适配器（真 `RuleHint`），`taskUseCase.list` 打成可控失败，读实际渲染的提示条文本。
 *              判据（PM 锁定）：① 空原因 ⇒ **提示条可见**且不含 `{reason}` / `undefined` / `null`；
 *              ② 兜底句必须含「会自动重试」这类可执行信息（**不得**塌缩成「刷新失败」四个字）；
 *              ③ 裸业务码（`10051` / `90022`）不外泄，走兜底句；④ **非纯数字的真实文案原样保留**
 *              （不得误清洗成兜底）。
 */

const SETTLE = async (): Promise<void> => {
    for (let i = 0; i < 8; i += 1) {
        await nextTick()
        await Promise.resolve()
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
}

type Harness = { wrapper: VueWrapper; failWith: (reason: string) => void }

const mountWithFail = (): Harness => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useTasksStore(pinia)
    const seed: TaskViewObject[] = [makeTask({ id: 't1', name: '任务-t1' })]
    store.addTasks(seed.map((t) => ({ ...t })))

    let reason: string | null = null
    const list = vi.fn(async () => {
        if (reason !== null) return [null, reason]
        store.addTasks(seed.map((t) => ({ ...t })))
        return [
            {
                taskIds: seed.map((t) => t.id),
                pagination: { total: 1, page: 1, limit: 20, maxPage: 1 }
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

    const wrapper = mount(ListViewAdapter, {
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
            multiSelectClearSignal: 0,
            taskClicked: vi.fn()
        } as never,
        global: { plugins: [pinia], components: NUE_COMPONENTS }
    })

    return {
        wrapper,
        failWith: (next: string) => {
            reason = next
            subscriber.emit('RefreshData' as never)
        }
    }
}

let mounted: VueWrapper[] = []
beforeEach(() => setLocale('zh-CN'))
afterEach(() => {
    mounted.forEach((w) => w.unmount())
    mounted = []
    document.body.innerHTML = ''
    setLocale('zh-CN')
    vi.restoreAllMocks()
})

const hint = (wrapper: VueWrapper) => wrapper.find('.task-refresh-warning')
const hintText = (wrapper: VueWrapper): string =>
    hint(wrapper).exists() ? hint(wrapper).text() : ''

describe('T663 末轮 · DEF-150：空原因也必须可见（不得失败静默）', () => {
    it('中文：空串 ⇒ 提示条可见 + 兜底句式含「正在显示上次加载的内容 / 稍后会自动重试」', async () => {
        const harness = mountWithFail()
        mounted.push(harness.wrapper)
        await SETTLE()
        harness.failWith('')
        await SETTLE()

        const text = hintText(harness.wrapper)
        console.log('[T663/probe150:zh-empty]', JSON.stringify({ visible: text !== '', text }))
        expect(text, '空原因必须仍然渲染提示条（不得静默）').not.toBe('')
        expect(text).toContain('刷新失败')
        expect(text, '兜底句不得塌缩成四个字：必须含「上次加载的内容」').toContain(
            '正在显示上次加载的内容'
        )
        expect(text, '必须有可执行的「会自动重试」信息').toContain('稍后会自动重试')
        expect(text).not.toMatch(/undefined|null|\{reason\}/)
    })

    it('中文：仅空白字符 ⇒ 同样走兜底句（trim 后为空）', async () => {
        const harness = mountWithFail()
        mounted.push(harness.wrapper)
        await SETTLE()
        harness.failWith('   \n  ')
        await SETTLE()

        const text = hintText(harness.wrapper)
        console.log('[T663/probe150:zh-blank]', JSON.stringify({ text }))
        expect(text).not.toBe('')
        expect(text).toContain('稍后会自动重试')
        expect(text).not.toMatch(/undefined|null|\{reason\}/)
    })

    it('英文：空串 ⇒ 可见 + English 兜底句含「retrying automatically」（不含中文）', async () => {
        setLocale('en-US')
        const harness = mountWithFail()
        mounted.push(harness.wrapper)
        await SETTLE()
        harness.failWith('')
        await SETTLE()

        const text = hintText(harness.wrapper)
        console.log('[T663/probe150:en-empty]', JSON.stringify({ text }))
        expect(text).not.toBe('')
        expect(text).toContain('Refresh failed')
        expect(text).toContain('retrying automatically')
        expect(text).not.toMatch(/[\u4e00-\u9fa5]/)
        expect(text).not.toMatch(/undefined|null|\{reason\}/)
    })
})

describe('T663 末轮 · 裸业务码清洗：码不外泄，但真实文案不得被误清洗', () => {
    it.each(['10051', '90022', ' 10051 '])('裸码 %s ⇒ 不外泄该码，走兜底句', async (code) => {
        const harness = mountWithFail()
        mounted.push(harness.wrapper)
        await SETTLE()
        harness.failWith(code)
        await SETTLE()

        const text = hintText(harness.wrapper)
        console.log('[T663/probe150:bare]', JSON.stringify({ code, text }))
        expect(text, '必须有提示条').not.toBe('')
        expect(text, '内部业务码不得出现在用户文案里').not.toContain(code.trim())
        expect(text).toContain('稍后会自动重试')
    })

    it.each(['网络不可用', '10051 请求过于频繁，请稍后再试', 'sync failed: timeout'])(
        '真实文案 %s ⇒ 原样保留（不得误清洗成兜底）',
        async (reason) => {
            const harness = mountWithFail()
            mounted.push(harness.wrapper)
            await SETTLE()
            harness.failWith(reason)
            await SETTLE()

            const text = hintText(harness.wrapper)
            console.log('[T663/probe150:real]', JSON.stringify({ reason, text }))
            expect(text).toContain(reason.trim())
        }
    )

    it('非空 → 空 的切换：仍可见并换成兜底句（不残留上一次文案）', async () => {
        const harness = mountWithFail()
        mounted.push(harness.wrapper)
        await SETTLE()

        harness.failWith('网络不可用')
        await SETTLE()
        expect(hintText(harness.wrapper)).toContain('网络不可用')

        harness.failWith('')
        await SETTLE()
        const text = hintText(harness.wrapper)
        console.log('[T663/probe150:switch]', JSON.stringify({ text }))
        expect(text).not.toBe('')
        expect(text, '不得残留上一次的具体原因').not.toContain('网络不可用')
        expect(text).toContain('稍后会自动重试')
    })
})

describe('T663 末轮 · 超长原因仍完整渲染（换行保护见 rule-hint 源级审计）', () => {
    it('中文超长（含 200 字符无空格 token）不被 JS 层截断', async () => {
        const longToken = 'A'.repeat(200)
        const reason = `${'限流说明文本，'.repeat(20)}${longToken}`
        const harness = mountWithFail()
        mounted.push(harness.wrapper)
        await SETTLE()
        harness.failWith(reason)
        await SETTLE()

        const text = hintText(harness.wrapper)
        console.log(
            '[T663/probe150:long]',
            JSON.stringify({
                length: text.length,
                hasToken: text.includes(longToken),
                tail: text.slice(-24)
            })
        )
        expect(text.includes(longToken), '长 reason 不得被截断').toBe(true)
        expect(text).toContain('稍后会自动重试')
    })
})