// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import type { VueWrapper } from '@vue/test-utils'
import {
    columnNodes,
    dragTaskTo,
    makeTask,
    mountKanban,
    settle,
    taskIdsIn,
    columnNode
} from './t608-kanban-harness'

/**
 * T612 AC5 —— 载荷键集合（**不可放宽**）· 新接缝（`groupBy` 注入）下的重测
 *
 * @description 需求：分组切换搬进「视图」菜单 + 状态上提（ADR
 *              `docs/adr/2026-11-01-kanban-group-state-hoisting.md`）⇒ 分组状态改为
 *              `KANBAN_GROUP_BY_KEY` 注入。本文件锁「搬家过程中写路径零变化」：
 *              `priority` 分组 ⇒ 载荷**只有** `{ priority }`；`state` 分组 ⇒ **只有** `{ state }`。
 *
 * 与 `t608-ac2-ac3` 的分工：那边经「切分组动作」进入优先级分组（`clickSegment`，接缝带过渡兼容），
 * 这边**只用注入**（`mountKanban(..., { groupBy })`）——即 RD 第 1 步（状态上提）后的真实形态，
 * 不进菜单、不点任何控件 ⇒ 载荷与 DOM 控件解耦。
 *
 * 状态（`T612` 红基线，2026-11-01 实测）：
 *   - AC5①（注入 `priority` ⇒ 优先级四列 + 只写 `priority`）⇒ **红**（注入尚未被读取，仍是状态三列）；
 *   - AC5②（注入 `state` ⇒ 只写 `state`）⇒ **绿**（回归护栏，防接缝改造把 state 分组写坏）。
 */

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

describe('T612 AC5 · 注入分组下的拖拽载荷键集合（不放宽）', () => {
    it("AC5① 注入 groupBy='priority' ⇒ 四列生效，拖拽载荷只有 { priority: 'urgent' }", async () => {
        const h = mountKanban(
            [
                makeTask({ id: 't-mid', state: 'todo', priority: 'medium' }),
                makeTask({ id: 't-other', state: 'done', priority: 'urgent' })
            ],
            null,
            { groupBy: 'priority' }
        )
        wrapper = h.wrapper
        await settle()

        // 先证「注入生效」：列集合已是优先级四档（否则下方「写 priority」可能只是碰巧）
        expect(
            columnNodes(h.wrapper).map((n) => n.attributes('data-category')),
            '注入 groupBy=priority 后列集合应为优先级四档（紧急→低）'
        ).toEqual(['urgent', 'high', 'medium', 'low'])
        expect(taskIdsIn(columnNode(h.wrapper, 'medium'))).toEqual(['t-mid'])

        await dragTaskTo(h.wrapper, 't-mid', 'urgent')

        const calls = h.calls()
        expect(calls, `实测写入 = ${JSON.stringify(calls, null, 2)}`).toEqual([
            { taskId: 't-mid', payload: { priority: 'urgent' } }
        ])
        expect(
            Object.keys(calls[0]!.payload),
            `载荷键实测 = ${JSON.stringify(Object.keys(calls[0]!.payload))}（不得含 state）`
        ).toEqual(['priority'])
        expect(calls[0]!.payload.state).toBeUndefined()
    })

    it("AC5② 注入 groupBy='state' ⇒ 拖拽载荷只有 { state: 'done' }（回归护栏）", async () => {
        const h = mountKanban(
            [makeTask({ id: 't-todo', state: 'todo', priority: 'medium' })],
            null,
            { groupBy: 'state' }
        )
        wrapper = h.wrapper
        await settle()

        expect(
            columnNodes(h.wrapper).map((n) => n.attributes('data-category')),
            '注入 groupBy=state 后列集合应为状态三列'
        ).toEqual(['todo', 'in-progress', 'done'])

        await dragTaskTo(h.wrapper, 't-todo', 'done')

        const calls = h.calls()
        expect(calls, `实测写入 = ${JSON.stringify(calls, null, 2)}`).toEqual([
            { taskId: 't-todo', payload: { state: 'done' } }
        ])
        expect(
            Object.keys(calls[0]!.payload),
            `载荷键实测 = ${JSON.stringify(Object.keys(calls[0]!.payload))}（不得含 priority）`
        ).toEqual(['state'])
        expect(calls[0]!.payload.priority).toBeUndefined()
    })
})