// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import type { VueWrapper } from '@vue/test-utils'
import {
    clickSegment,
    dragTaskTo,
    makeTask,
    mountKanban,
    taskIdsIn,
    columnNode
} from './t608-kanban-harness'

/**
 * T608 AC2 / AC3 —— 拖拽**实际写入载荷**（`DEF-114` 核心 bug）
 *
 * @description 判据落点 = **仓储 `taskUseCase.update` 的入参**（`use-kanban.ts` 的
 *              `handleTaskDrop` 是唯一写点）。不拿 DOM 顺序当证据：spy 不改 props，
 *              拖拽后卡片不会移动 ⇒ 「拖完还在原列」既可能是成功也可能是失败。
 *
 * 改动前 bug：`priority` 分组下拖到「紧急」列 ⇒ 写 `update(taskId, { state: 'urgent' })`
 *             （`state` 被写成非法值），而 `priority` 分毫未动（`R2` 交叉写）。
 *
 * 状态：
 *   - AC2①②（priority 分组写载荷 / 同档不重复写）⇒ **红**（今日：写 `state`，且同档卡片仍会写）。
 *   - AC3①②（state 分组写载荷 / 同档不重复写）⇒ **绿**（回归护栏，防接线时把 state 分组写坏）。
 *
 * 说明：AC2 依赖「分组切换入口」（AC1a）。入口未实现时本文件 AC2 红在「缺入口」，
 *       入口实现后仍红 ⇒ 说明写字段分支没接对（`R2`）。
 */

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

describe('T608 AC2 · priority 分组下拖拽只写 priority', () => {
    it("AC2① 「中」拖到「紧急」⇒ 载荷只含 priority='urgent'，state 不出现", async () => {
        const h = mountKanban([
            makeTask({ id: 't-mid', state: 'todo', priority: 'medium' }),
            makeTask({ id: 't-other', state: 'done', priority: 'urgent' })
        ])
        wrapper = h.wrapper

        await clickSegment(h.wrapper, 'priority')
        expect(h.update, '切换分组本身不应触发写操作').not.toHaveBeenCalled()

        await dragTaskTo(h.wrapper, 't-mid', 'urgent')

        const calls = h.calls()
        expect(calls, `实测写入 = ${JSON.stringify(calls, null, 2)}`).toEqual([
            { taskId: 't-mid', payload: { priority: 'urgent' } }
        ])
        // 核心：**绝不**交叉写 state（R2）
        expect(
            Object.keys(calls[0]!.payload),
            `载荷键实测 = ${JSON.stringify(Object.keys(calls[0]!.payload))}（不得含 state）`
        ).toEqual(['priority'])
        // 也不得把 state 顺手写成非法值
        expect(calls[0]!.payload.state).toBeUndefined()
    })

    it('AC2② 同档拖拽（已是「紧急」拖到「紧急」列）⇒ 不产生写操作', async () => {
        const h = mountKanban([
            makeTask({ id: 't-urgent', state: 'todo', priority: 'urgent' }),
            makeTask({ id: 't-mid', state: 'todo', priority: 'medium' })
        ])
        wrapper = h.wrapper

        await clickSegment(h.wrapper, 'priority')
        await dragTaskTo(h.wrapper, 't-urgent', 'urgent')

        expect(
            h.calls(),
            `同档拖拽不应写库（否则每次拖拽都会产生无意义的同步写入）：实测 ${JSON.stringify(h.calls())}`
        ).toEqual([])
    })

    it('AC2③ priority 分组下拖拽不改卡片所在列以外的内容（列内容仍按优先级）', async () => {
        const h = mountKanban([
            makeTask({ id: 't-mid', state: 'todo', priority: 'medium' }),
            makeTask({ id: 't-low', state: 'done', priority: 'low' })
        ])
        wrapper = h.wrapper

        await clickSegment(h.wrapper, 'priority')
        await dragTaskTo(h.wrapper, 't-mid', 'urgent')

        // 与写入无关的列不受影响（拖拽不得污染其它列）
        expect(taskIdsIn(columnNode(h.wrapper, 'low'))).toEqual(['t-low'])
    })
})

describe('T608 AC3 · state 分组下拖拽只写 state（防交叉写回归）', () => {
    it("AC3① 「待办」拖到「已完成」⇒ 载荷只含 state='done'，priority 不出现", async () => {
        const h = mountKanban([
            makeTask({ id: 't-todo', state: 'todo', priority: 'medium' }),
            makeTask({ id: 't-done', state: 'done', priority: 'high' })
        ])
        wrapper = h.wrapper

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

    it('AC3② 同状态拖拽（已在「待办」拖到「待办」列）⇒ 不产生写操作', async () => {
        const h = mountKanban([makeTask({ id: 't-todo', state: 'todo', priority: 'medium' })])
        wrapper = h.wrapper

        await dragTaskTo(h.wrapper, 't-todo', 'todo')

        expect(h.calls()).toEqual([])
    })
})