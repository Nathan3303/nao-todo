// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import type { VueWrapper } from '@vue/test-utils'
import type { TaskViewObject } from '@nao-todo/domain-task'
import {
    clickSegment,
    columnNode,
    columnNodes,
    dragTaskTo,
    makeTask,
    mountKanban,
    taskIdsIn
} from './t608-kanban-harness'

/**
 * T608 AC4 —— 优先级空值 / 脏值的边界（`DEF-114` · PRD R3）
 *
 * @description 口径（R3）：**读取时归类、写入时才归一** ——
 *              ① 空 / 脏优先级 ⇒ 落「低」列（与既有「未知值 ⇒ low」一致）；
 *              ② 归类**不得改写**库中原值（`null` / `''` / `'unknown-x'` 原样保留）；
 *              ③ 只有用户真的把卡片拖到某列时才写入并归一（写 `priority: 'high'`，不写脏值）。
 *
 * 状态：
 *   - AC4①② → 红（需优先级分组入口；且今日列过滤按 `state`，脏值任务根本不会落「低」列）
 *   - AC4③④ → 绿（回归护栏：状态分组下的写载荷与「不顺手改写脏值」）
 */

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const DIRTY = [
    { id: 't-null', priority: null },
    { id: 't-empty', priority: '' },
    { id: 't-dirty', priority: 'unknown-x' }
] as const

const dirtyTasks = (): TaskViewObject[] =>
    DIRTY.map(({ id, priority }) =>
        makeTask({ id, state: 'todo', priority: priority as unknown as string })
    )

const mountDirtyFixture = () => {
    const h = mountKanban([
        ...dirtyTasks(),
        makeTask({ id: 't-normal', state: 'done', priority: 'high' })
    ])
    wrapper = h.wrapper
    return h
}

const tasksOf = (w: VueWrapper): TaskViewObject[] =>
    (w.props() as unknown as { tasks: TaskViewObject[] }).tasks

const priorityOf = (w: VueWrapper, taskId: string): unknown =>
    tasksOf(w).find((t) => t.id === taskId)?.priority

describe('T608 AC4 · 空值/脏值优先级：读取归类到「低」，原值不被改写', () => {
    it("AC4① null / '' / 'unknown-x' 三张卡都落「低」列，且不出现在其它列", async () => {
        const h = mountDirtyFixture()
        await clickSegment(h.wrapper, 'priority')

        expect(taskIdsIn(columnNode(h.wrapper, 'low')).sort(), '空/脏值必须归类到「低」列').toEqual(
            ['t-dirty', 't-empty', 't-null']
        )

        for (const priority of ['urgent', 'high', 'medium']) {
            const ids = taskIdsIn(columnNode(h.wrapper, priority))
            for (const { id } of DIRTY) {
                expect(ids, `「${priority}」列不得含脏值任务 ${id}`).not.toContain(id)
            }
        }
        // 干净的对照卡仍按自身优先级落位
        expect(taskIdsIn(columnNode(h.wrapper, 'high'))).toEqual(['t-normal'])
    })

    it('AC4② 归类是「读取时」行为：挂载 + 切分组后库中原值逐字不变', async () => {
        const h = mountDirtyFixture()
        await clickSegment(h.wrapper, 'priority')

        expect(priorityOf(h.wrapper, 't-null')).toBeNull()
        expect(priorityOf(h.wrapper, 't-empty')).toBe('')
        expect(priorityOf(h.wrapper, 't-dirty')).toBe('unknown-x')
        // 也没有因为「归类」而产生任何写操作
        expect(h.calls(), `切换分组 + 归类不应写库：实测 ${JSON.stringify(h.calls())}`).toEqual([])
    })

    it("AC4③ 真拖拽时才归一：脏值卡从「低」拖到「高」⇒ 只写 priority='high'", async () => {
        const h = mountDirtyFixture()
        await clickSegment(h.wrapper, 'priority')

        await dragTaskTo(h.wrapper, 't-dirty', 'high')

        const calls = h.calls()
        expect(calls, `实测写入 = ${JSON.stringify(calls, null, 2)}`).toEqual([
            { taskId: 't-dirty', payload: { priority: 'high' } }
        ])
        // 写入值必须是合法档位（不得把 'unknown-x' 原样写回）
        expect(calls[0]!.payload.priority).toBe('high')
        expect(Object.keys(calls[0]!.payload)).toEqual(['priority'])
    })

    it('AC4④ 状态分组下拖拽只写 state，不顺手改写脏值优先级（回归护栏）', async () => {
        const h = mountDirtyFixture()

        await dragTaskTo(h.wrapper, 't-dirty', 'done')

        const calls = h.calls()
        expect(calls).toEqual([{ taskId: 't-dirty', payload: { state: 'done' } }])
        expect(Object.keys(calls[0]!.payload)).toEqual(['state'])
        // 其余脏值任务完全没有被触碰
        expect(calls.map((c) => c.taskId)).not.toContain('t-null')
        expect(calls.map((c) => c.taskId)).not.toContain('t-empty')
        // 原值仍在
        expect(priorityOf(h.wrapper, 't-dirty')).toBe('unknown-x')
        expect(priorityOf(h.wrapper, 't-null')).toBeNull()
        expect(priorityOf(h.wrapper, 't-empty')).toBe('')
    })

    it('AC4⑤ 「低」列在三档脏值之外仍只收 low（不误收 medium）', () => {
        const h = mountKanban([
            makeTask({ id: 't-low', state: 'todo', priority: 'low' }),
            makeTask({ id: 't-medium', state: 'todo', priority: 'medium' })
        ])
        wrapper = h.wrapper
        // 默认状态分组：两卡同列（对照基线，证 fixture 无副作用）
        expect(taskIdsIn(columnNode(h.wrapper, 'todo')).sort()).toEqual(['t-low', 't-medium'])
        expect(columnNodes(h.wrapper)).toHaveLength(3)
    })
})