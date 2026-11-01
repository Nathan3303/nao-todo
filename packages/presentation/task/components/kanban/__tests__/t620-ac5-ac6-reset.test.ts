// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import type { VueWrapper } from '@vue/test-utils'
import type { TaskViewObject } from '@nao-todo/domain-task'
import {
    clickSegment,
    columnNode,
    columnNodes,
    columnTotal,
    listCallsFor,
    makeTask,
    mountKanban,
    scrollToBottom,
    settle,
    taskIdsIn
} from './t608-kanban-harness'

/**
 * `T620` AC5 / AC6 —— **重置规则**（PRD R-C）
 *
 * @description 三源：`RefreshData`（`refreshToken`）/ 筛选（`getTasksOptions`）/ 排序（`sortOptions`）
 *              + **分组切换**（`:key` 结构性重建，ADR 决策 3）。
 *              判据 = 列内卡片回到第 1 页（20 条）**且**列头总数不变（重置的是游标，不是数据）。
 *
 * 状态（`T620` 红基线，2026-11-01 HEAD `29cbe4c0` 实测）：
 *   - AC5① ⇒ **红**（现状列内没有游标可重置，列内容恒为「全部 45 条」）
 *   - AC6① ⇒ **红**（`getTasksOptions` 尚未成为看板 prop；筛选变化既不复位也不求交）
 *   - AC6② ⇒ **红**（排序变化无重置路径）
 *   - AC6③① ⇒ **红**（切分组后列内容仍是「全部 45 条」，不是第 1 页 20 条）
 *   - AC6③②（旧列实例销毁重建 ⇒ 新元素）⇒ 现 **绿**（`v-for` 键集合 state/priority 互斥，切换天然重建）
 *     —— 保留为结构性护栏
 *   - AC6③③（源码守卫：`:key` 必须含 `groupBy`）⇒ **红**（现状 `:key="groupName"`，ADR 决策 3 要求带分组前缀）
 */

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const pad = (value: number): string => String(value).padStart(2, '0')

/** 45 条待办，前 23 条「高」、其余「中」（筛选求交用） */
const makeFilterableTasks = (): TaskViewObject[] =>
    Array.from({ length: 45 }, (_, index) =>
        makeTask({
            id: `todo-${pad(index + 1)}`,
            state: 'todo',
            priority: index < 23 ? 'high' : 'medium'
        })
    )

const makeTodoTasks = (count: number): TaskViewObject[] =>
    Array.from({ length: count }, (_, index) =>
        makeTask({ id: `todo-${pad(index + 1)}`, state: 'todo', priority: 'medium' })
    )

const STATE_CATEGORIES = new Set(['todo', 'in-progress', 'done'])
const PRIORITY_CATEGORIES = new Set(['urgent', 'high', 'medium', 'low'])

describe('T620 AC5 · 重置 · RefreshData', () => {
    it('AC5① 已加载 3 页 ⇒ RefreshData 后各列回第 1 页（20 条），列头总数不变', async () => {
        const h = mountKanban([
            ...makeTodoTasks(45),
            makeTask({ id: 'done-01', state: 'done', priority: 'medium' }),
            makeTask({ id: 'done-02', state: 'done', priority: 'medium' }),
            makeTask({ id: 'done-03', state: 'done', priority: 'medium' })
        ])
        wrapper = h.wrapper
        await settle()
        // 前置：把待办列翻到 45 条
        await scrollToBottom(h.wrapper, 'todo')
        await scrollToBottom(h.wrapper, 'todo')
        expect(taskIdsIn(columnNode(h.wrapper, 'todo')), '前置：应先加载完 3 页').toHaveLength(45)

        await h.refresh()

        expect(
            taskIdsIn(columnNode(h.wrapper, 'todo')),
            'RefreshData 后待办列应回到第 1 页（20 条）'
        ).toHaveLength(20)
        expect(columnTotal(columnNode(h.wrapper, 'todo')), '重置游标不改变总数').toBe(45)
        expect(taskIdsIn(columnNode(h.wrapper, 'done')), '已完成列同样重置为第 1 页').toEqual([
            'done-01',
            'done-02',
            'done-03'
        ])
    })
})

describe('T620 AC6 · 重置 · 筛选 / 排序 / 分组切换', () => {
    it('AC6① 筛选变化 ⇒ 各列回第 1 页，且列查询 = 用户筛选 ∩ 列条件（求交）', async () => {
        const h = mountKanban(makeFilterableTasks())
        wrapper = h.wrapper
        await settle()
        await scrollToBottom(h.wrapper, 'todo')
        await scrollToBottom(h.wrapper, 'todo')
        expect(taskIdsIn(columnNode(h.wrapper, 'todo')), '前置：先加载完 45 条').toHaveLength(45)

        await h.setFilters({ priority: 'high' })

        const ids = taskIdsIn(columnNode(h.wrapper, 'todo'))
        expect(ids, '筛选变化后应回到第 1 页（20 条）').toHaveLength(20)
        expect(columnTotal(columnNode(h.wrapper, 'todo')), '列头 = 求交后的总数（23）').toBe(23)
        const priorities = ids.map((id) => h.db().find((task) => task.id === id)?.priority)
        expect(
            priorities.every((priority) => priority === 'high'),
            `列内必须只剩「高」：实测 ${JSON.stringify(priorities)}`
        ).toBe(true)

        const lastCall = listCallsFor(h, 'state', 'todo').at(-1)
        expect(lastCall?.state, '列条件仍是 state=todo').toBe('todo')
        expect(lastCall?.priority, '用户筛选 priority=high 必须被保留（求交，不是覆盖）').toBe(
            'high'
        )
    })

    it('AC6② 排序变化 ⇒ 各列回第 1 页，且查询带上新排序', async () => {
        const h = mountKanban(makeTodoTasks(45))
        wrapper = h.wrapper
        await settle()
        await scrollToBottom(h.wrapper, 'todo')
        await scrollToBottom(h.wrapper, 'todo')
        expect(taskIdsIn(columnNode(h.wrapper, 'todo'))).toHaveLength(45)

        await h.setSort({ field: 'updatedAt', order: 'asc' })

        expect(
            taskIdsIn(columnNode(h.wrapper, 'todo')),
            '排序变化后应回到第 1 页（20 条）'
        ).toHaveLength(20)
        expect(columnTotal(columnNode(h.wrapper, 'todo')), '排序不改变总数').toBe(45)
        const lastCall = listCallsFor(h, 'state', 'todo').at(-1)
        expect(lastCall?.sort, '新排序必须下传到列查询').toEqual({
            field: 'updatedAt',
            order: 'asc'
        })
    })

    it('AC6③① 切分组 ⇒ 各列按新分组字段回第 1 页（不沿用旧分组游标）', async () => {
        const h = mountKanban(makeTodoTasks(45))
        wrapper = h.wrapper
        await settle()
        await scrollToBottom(h.wrapper, 'todo')
        await scrollToBottom(h.wrapper, 'todo')
        expect(taskIdsIn(columnNode(h.wrapper, 'todo'))).toHaveLength(45)

        await clickSegment(h.wrapper, 'priority')

        expect(
            columnNodes(h.wrapper).map((n) => n.attributes('data-category')),
            '切到优先级分组后应是 4 列'
        ).toEqual(['urgent', 'high', 'medium', 'low'])
        expect(
            taskIdsIn(columnNode(h.wrapper, 'medium')),
            '「中」列应回第 1 页（20 条），且按 priority 查询'
        ).toHaveLength(20)
        expect(columnTotal(columnNode(h.wrapper, 'medium')), '「中」列总数 = 45').toBe(45)

        // 不得出现「旧列拿新分组查错字段」的空转查询（ADR 决策 3 用 `:key` 避免）
        const nonsense = h.listCalls().filter((options) => {
            const byState = (options.state ?? '')
                .split(',')
                .filter(Boolean)
                .some((value) => PRIORITY_CATEGORIES.has(value))
            const byPriority = (options.priority ?? '')
                .split(',')
                .filter(Boolean)
                .some((value) => STATE_CATEGORIES.has(value))
            return byState || byPriority
        })
        expect(
            nonsense,
            `分组字段与列名错配的查询必须为 0（实测 ${JSON.stringify(nonsense)}）`
        ).toEqual([])
    })

    it('AC6③② 旧列实例被销毁重建（切走再切回 ⇒ 不是同一个列元素）', async () => {
        const h = mountKanban(makeTodoTasks(3))
        wrapper = h.wrapper
        await settle()

        const before = columnNode(h.wrapper, 'todo').element
        await clickSegment(h.wrapper, 'priority')
        await clickSegment(h.wrapper, 'state')
        const after = columnNode(h.wrapper, 'todo').element

        expect(after, '切回状态分组后应是一个新的列实例（结构性重建）').not.toBe(before)
        expect(taskIdsIn(columnNode(h.wrapper, 'todo')), '重建后从第 1 页开始').toHaveLength(3)
    })

    it('AC6③③ 源码守卫：列的 `:key` 必须含 `groupBy`（结构性重置的唯一实现方式）', () => {
        const kanbanSource = (
            Object.values(
                import.meta.glob('/packages/presentation/task/components/kanban/kanban.vue', {
                    query: '?raw',
                    import: 'default',
                    eager: true
                }) as Record<string, string>
            ) as string[]
        ).join('\n')

        expect(kanbanSource, 'kanban.vue 源码应可读').not.toBe('')
        expect(
            kanbanSource,
            '列 `v-for` 的 `:key` 必须包含 `groupBy`（ADR 决策 3：分组切换靠结构性重建重置）'
        ).toMatch(/:key="[^"]*groupBy[^"]*"/)
    })
})