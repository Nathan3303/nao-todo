// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import type { VueWrapper } from '@vue/test-utils'
import type { TaskViewObject } from '@nao-todo/domain-task'
import {
    columnNode,
    disableBarNode,
    isNoMoreVisible,
    listCallsFor,
    makeTask,
    mountKanban,
    NO_MORE_TEXT,
    scrollToBottom,
    scrollUntilStable,
    settle,
    taskIdsIn
} from './t608-kanban-harness'

/**
 * `T620` AC4 —— 到底后**不再请求** + 「没有更多了」**可见**（PRD R-B / R-L）
 *
 * @description 两个独立判据：
 *   ① **零增量**：该列已加载完后再滚 ⇒ `taskUseCase.list` 对该列的调用次数**增量 0**；
 *   ② **可见性**：不能只断言 DOM 存在 —— 现状 `kanban-column.vue` 的 `<style scoped>` 把
 *      `__disable-bar` / `__loading-bar` 都 `display:none` 了（「没有更多数据了」DOM 存在但不可见）。
 *      jsdom 不解析 SFC scoped 样式 ⇒ 光靠 `getComputedStyle` 查不出 ⇒ 追加一条**源码级守卫**：
 *      组件/样式表里**不得存在**针对 `__disable-bar` 的 `display: none` 规则。
 *
 * 状态（`T620` 红基线，2026-11-01 HEAD `29cbe4c0` 实测）：
 *   - AC4① ⇒ **红**（`list` 从未被列内调用 ⇒ 该列「到底」是假的；判据先被 AC4②/AC9 触发前就失真）
 *   - AC4② ⇒ **红**（文案是「没有更多数据了」而非用户口径「没有更多了」，且被 CSS 隐藏）
 *   - AC4③ ⇒ **红**（现状 `kanban-column.vue:64-67` 正是那条隐藏规则）
 */

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const pad = (value: number): string => String(value).padStart(2, '0')

const makeTodoTasks = (count: number): TaskViewObject[] =>
    Array.from({ length: count }, (_, index) =>
        makeTask({ id: `todo-${pad(index + 1)}`, state: 'todo', priority: 'medium' })
    )

/** 看板列组件的**样式**（`?raw`，与仓内既有样式契约测试同法；glob 只能写字面量） */
const cssTexts = (): string[] => {
    const vueSources = Object.values(
        import.meta.glob('/packages/presentation/task/components/kanban/kanban-column.vue', {
            query: '?raw',
            import: 'default',
            eager: true
        }) as Record<string, string>
    ) as string[]
    const plainStyles = Object.values(
        import.meta.glob('/packages/presentation/task/components/kanban/*.css', {
            query: '?raw',
            import: 'default',
            eager: true
        }) as Record<string, string>
    ) as string[]
    const styleBlocks = vueSources.flatMap((source) =>
        Array.from(source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)).map(
            (matched) => matched[1] ?? ''
        )
    )
    return [...styleBlocks, ...plainStyles]
}

/** 形如 `selector { ... }` 的规则块（选择器 = `{` 之前的部分） */
const cssRuleBlocks = (source: string): string[] => source.match(/[^{}]+\{[^{}]*\}/g) ?? []

describe('T620 AC4 · 到底后零请求 + 「没有更多了」可见', () => {
    it('AC4① 到底后继续触底 ⇒ 该列查询次数零增量', async () => {
        const h = mountKanban(makeTodoTasks(45))
        wrapper = h.wrapper
        await settle()

        const ids = await scrollUntilStable(h.wrapper, 'todo')
        expect(ids, '前置：45 条应全部加载完').toHaveLength(45)
        expect(
            listCallsFor(h, 'state', 'todo').length,
            '前置：到底前必须真的翻过 3 页（否则「零增量」是假命题）'
        ).toBe(3)
        const callsAfterDone = listCallsFor(h, 'state', 'todo').length

        await scrollToBottom(h.wrapper, 'todo')
        await scrollToBottom(h.wrapper, 'todo')
        await scrollToBottom(h.wrapper, 'todo')

        expect(
            listCallsFor(h, 'state', 'todo').length,
            `到底后再滚动不得再发查询（之前 ${callsAfterDone} 次）`
        ).toBe(callsAfterDone)
        expect(taskIdsIn(columnNode(h.wrapper, 'todo')), '到底后卡片不得变化').toHaveLength(45)
    })

    it('AC4② 到底文案「没有更多了」在列内可见（不是 DOM 存在即算过）', async () => {
        const h = mountKanban(makeTodoTasks(45))
        wrapper = h.wrapper
        await settle()
        await scrollUntilStable(h.wrapper, 'todo')

        const bar = disableBarNode(columnNode(h.wrapper, 'todo'))
        expect(bar, '列内应有 nue-infinite-scroll 的「到底」条').not.toBeNull()
        expect(
            (bar!.textContent ?? '').replace(/\s+/g, ''),
            '文案必须是用户口径「没有更多了」（现状是「没有更多数据了」）'
        ).toContain(NO_MORE_TEXT)
        expect(isNoMoreVisible(columnNode(h.wrapper, 'todo')), '「没有更多了」必须可见').toBe(true)
    })

    it('AC4③ 源码守卫：不得再对「到底」条设 `display: none`（R-L）', () => {
        const hidingRules = cssTexts()
            .flatMap(cssRuleBlocks)
            .filter((block) => (block.split('{')[0] ?? '').includes('__disable-bar'))
            .filter((block) => /display\s*:\s*none/.test(block))

        expect(
            hidingRules,
            `看板列样式里仍有隐藏「到底」条的规则（R-L 要求删除并改用 #disabled 槽渲染）：${JSON.stringify(hidingRules)}`
        ).toEqual([])
    })
})