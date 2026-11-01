// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import type { VueWrapper } from '@vue/test-utils'
import {
    clickSegment,
    columnNode,
    columnTotal,
    dragTaskTo,
    makeTask,
    mountKanban,
    settle,
    taskIdsIn
} from './t608-kanban-harness'

/**
 * `T620` AC8 —— 跨列拖拽后**两列计数即时正确**（PRD R-M / `DEF-114` 载荷口径不变）
 *
 * @description 判据三件套：① 写载荷仍是 `{ state }` / `{ priority }` **各自唯一**（不放宽既有断言）；
 *              ② 源列 `total - 1`、目标列 `total + 1`（列头数字 = 总数，AC3 的前提）；
 *              ③ 卡片即时落到目标列（本地增量，不塌回第 1 页）。
 *
 * 状态（`T620` 红基线，2026-11-01 HEAD `29cbe4c0` 实测）：AC8①② ⇒ **红**
 *   （列头现在是「已渲染条数」，拖拽后 props 不变 ⇒ 源列/目标列计数都不动）
 */

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

describe('T620 AC8 · 拖拽后两列 total ±1（载荷键集合不放宽）', () => {
    it('AC8① state 分组：待办 → 已完成 ⇒ 载荷唯一 `state`，两列 total 各 ±1，卡片落到目标列', async () => {
        const h = mountKanban([
            makeTask({ id: 't-1', state: 'todo', priority: 'medium' }),
            makeTask({ id: 't-2', state: 'todo', priority: 'medium' }),
            makeTask({ id: 't-3', state: 'done', priority: 'medium' })
        ])
        wrapper = h.wrapper
        await settle()

        expect(columnTotal(columnNode(h.wrapper, 'todo')), '前置：待办 2 条').toBe(2)
        expect(columnTotal(columnNode(h.wrapper, 'done')), '前置：已完成 1 条').toBe(1)

        await dragTaskTo(h.wrapper, 't-1', 'done')

        const calls = h.calls()
        expect(calls, `实测写入 = ${JSON.stringify(calls, null, 2)}`).toEqual([
            { taskId: 't-1', payload: { state: 'done' } }
        ])
        expect(
            Object.keys(calls[0]!.payload),
            `载荷键实测 = ${JSON.stringify(Object.keys(calls[0]!.payload))}（不得含 priority）`
        ).toEqual(['state'])

        expect(columnTotal(columnNode(h.wrapper, 'todo')), '源列 total 应 -1').toBe(1)
        expect(columnTotal(columnNode(h.wrapper, 'done')), '目标列 total 应 +1').toBe(2)
        expect(taskIdsIn(columnNode(h.wrapper, 'todo')), '源列卡片应即时减少').toEqual(['t-2'])
        expect(
            taskIdsIn(columnNode(h.wrapper, 'done')),
            '目标列卡片应即时增加（本地增量，不等重查）'
        ).toContain('t-1')
    })

    it('AC8② priority 分组：中 → 紧急 ⇒ 载荷唯一 `priority`，两列 total 各 ±1', async () => {
        const h = mountKanban(
            [
                makeTask({ id: 't-mid', state: 'todo', priority: 'medium' }),
                makeTask({ id: 't-mid-2', state: 'todo', priority: 'medium' }),
                makeTask({ id: 't-urgent', state: 'todo', priority: 'urgent' })
            ],
            null,
            { groupBy: 'priority' }
        )
        wrapper = h.wrapper
        await settle()

        expect(columnTotal(columnNode(h.wrapper, 'medium')), '前置：中 2 条').toBe(2)
        expect(columnTotal(columnNode(h.wrapper, 'urgent')), '前置：紧急 1 条').toBe(1)

        await dragTaskTo(h.wrapper, 't-mid', 'urgent')

        const calls = h.calls()
        expect(calls, `实测写入 = ${JSON.stringify(calls, null, 2)}`).toEqual([
            { taskId: 't-mid', payload: { priority: 'urgent' } }
        ])
        expect(
            Object.keys(calls[0]!.payload),
            `载荷键实测 = ${JSON.stringify(Object.keys(calls[0]!.payload))}（不得含 state）`
        ).toEqual(['priority'])

        expect(columnTotal(columnNode(h.wrapper, 'medium')), '源列 total 应 -1').toBe(1)
        expect(columnTotal(columnNode(h.wrapper, 'urgent')), '目标列 total 应 +1').toBe(2)
        expect(taskIdsIn(columnNode(h.wrapper, 'urgent'))).toContain('t-mid')

        // 与写路径无关的第三列不受影响
        expect(columnTotal(columnNode(h.wrapper, 'low')), '「低」列不得被牵连').toBe(0)
    })

    it('AC8③ 同列拖拽（已在目标列）⇒ 不写库、计数不变', async () => {
        const h = mountKanban([makeTask({ id: 't-1', state: 'todo', priority: 'medium' })])
        wrapper = h.wrapper
        await settle()

        await dragTaskTo(h.wrapper, 't-1', 'todo')

        expect(h.calls(), '同列拖拽不应写库').toEqual([])
        expect(columnTotal(columnNode(h.wrapper, 'todo')), '同列拖拽计数不变').toBe(1)
    })

    it('AC8④ 分组切换不产生写操作（对照：载荷只在真拖拽时出现）', async () => {
        const h = mountKanban([
            makeTask({ id: 't-1', state: 'todo', priority: 'medium' }),
            makeTask({ id: 't-2', state: 'done', priority: 'urgent' })
        ])
        wrapper = h.wrapper
        await settle()

        await clickSegment(h.wrapper, 'priority')
        expect(h.calls(), '切换分组本身不应触发写操作').toEqual([])
    })
})