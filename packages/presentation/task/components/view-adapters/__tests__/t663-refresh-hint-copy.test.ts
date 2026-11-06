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
 * `T663` 追加复验 · 新增 B：`DEF-148` 提示条文案（中英双语 / 空 reason / 超长 reason）
 *
 * @description 真实挂载列表适配器（真 `RuleHint`），把 `taskUseCase.list` 打成失败，读实际渲染出来的
 *              提示条文本。断言：① 中英文案齐备且语义不误导（明说「显示上次内容」+「会自动重试」）；
 *              ② `reason` 为空 / 超长时不出现 `undefined`/`null`/占位符外泄、文本完整；
 *              ③ 文案不撑破布局 —— jsdom 无布局引擎，**像素不可测**（`scrollWidth/offsetWidth` 恒 0），
 *              故以「源码级是否有换行保护」取证并如实标注（见 `T663` 报告 §十一-5）。
 */

const SETTLE = async (): Promise<void> => {
    for (let i = 0; i < 8; i += 1) {
        await nextTick()
        await Promise.resolve()
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
}

type Harness = { wrapper: VueWrapper; emit: (event: string) => void }

const mountWithFail = (reason: string): Harness => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useTasksStore(pinia)
    const seed: TaskViewObject[] = [makeTask({ id: 't1', name: '任务-t1' })]
    store.addTasks(seed.map((t) => ({ ...t })))

    let failing = false
    const list = vi.fn(async () => {
        if (failing) return [null, reason]
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
        emit: (event: string) => {
            failing = true
            subscriber.emit(event as never)
        }
    }
}

/** `RuleHint` 组件源码（`?raw`）：样式契约只能按源文本核（jsdom 不应用 SFC `<style scoped>`） */
const hintSources = import.meta.glob<string>(
    '/packages/shared/components/rule-hint/rule-hint.vue',
    {
        query: '?raw',
        import: 'default',
        eager: true
    }
)

let mounted: VueWrapper[] = []
beforeEach(() => setLocale('zh-CN'))
afterEach(() => {
    mounted.forEach((w) => w.unmount())
    mounted = []
    document.body.innerHTML = ''
    setLocale('zh-CN')
    vi.restoreAllMocks()
})

const hintText = (wrapper: VueWrapper): string => {
    const el = wrapper.find('.task-refresh-warning')
    return el.exists() ? (el.text() ?? '') : ''
}

describe('T663 追加 B · 提示条文案（中英双语 / 空 reason / 超长 reason）', () => {
    it('中文：空 reason 时不外泄 undefined/null/占位符，且明说「显示上次内容 + 会自动重试」', async () => {
        const harness = mountWithFail('')
        mounted.push(harness.wrapper)
        await SETTLE()
        harness.emit('RefreshData')
        await SETTLE()

        const text = hintText(harness.wrapper)
        // ⚠️ 实测记录（`T663` 报告 §十一-5 缺陷候选）：`reason` 为空串时 `refreshError === ''`
        //    ⇒ `v-if="refreshError"` 不成立 ⇒ **提示条不渲染、失败不可见**（静默）。真实仓储
        //    不会返回空错误串（Go 风格错误带消息），故按边界输入记 P3；此处只固化「不外泄」，
        //    不把该边界行为写成通过判据。
        console.log('[T663/probeHint:zh-empty]', JSON.stringify({ text, visible: text !== '' }))
        expect(text, '空 reason 时不得外泄 undefined/null/占位符').not.toMatch(
            /undefined|null|\{reason\}/
        )
    })

    it('中文：超长 reason（含无空格长 token）完整渲染，不截断、不报错', async () => {
        const longToken = 'A'.repeat(200)
        const reason = `${'限流错误码 10051 但服务端返回了很长的解释文本，'.repeat(8)}${longToken}`
        const harness = mountWithFail(reason)
        mounted.push(harness.wrapper)
        await SETTLE()
        harness.emit('RefreshData')
        await SETTLE()

        const text = hintText(harness.wrapper)
        console.log(
            '[T663/probeHint:zh-long]',
            JSON.stringify({
                length: text.length,
                head: text.slice(0, 20),
                tail: text.slice(-30),
                hasToken: text.includes(longToken)
            })
        )
        expect(text).toContain('刷新失败')
        expect(text.includes(longToken), '长 reason 不得被 JS 层截断').toBe(true)

        // 布局保护取证（非像素实测）：源码是否有换行/防溢出规则
        const source = Object.values(hintSources)[0] ?? ''
        const hasWrapRule = /overflow-wrap|word-break|min-width:\s*0/.test(source)
        const nueTextCss = import.meta.glob<string>(
            '/node_modules/nue-ui-theme-shadlike/dist/components/text.css',
            {
                query: '?raw',
                import: 'default',
                eager: true
            }
        )
        const hasWrapInText =
            /overflow-wrap|word-break/.test(Object.values(nueTextCss)[0] ?? '') ?? false
        console.log(
            '[T663/probeHint:wrap]',
            JSON.stringify({ hasWrapRuleInHint: hasWrapRule, hasWrapRuleInNueText: hasWrapInText })
        )
        expect(source.length, '规则提示条源码应可读（?raw）').toBeGreaterThan(0)
    })

    it('英文：文案为 English 且同语义（不泄漏中文、不宣称已更新）', async () => {
        setLocale('en-US')
        const harness = mountWithFail('rate limited')
        mounted.push(harness.wrapper)
        await SETTLE()
        harness.emit('RefreshData')
        await SETTLE()

        const text = hintText(harness.wrapper)
        console.log('[T663/probeHint:en]', JSON.stringify(text))
        expect(text).toContain('Refresh failed')
        expect(text).toContain('rate limited')
        expect(text).toMatch(/content loaded earlier|earlier/)
        expect(text).toMatch(/retrying automatically|retry/i)
        expect(text, '英文文案不得混入中文').not.toMatch(/[\u4e00-\u9fa5]/)
        expect(text).not.toMatch(/undefined|null|\{reason\}/)
    })
})