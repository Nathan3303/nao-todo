import { describe, expect, it } from 'vite-plus/test'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { searchTasksPage } from '../search-tasks'

/**
 * T770 · 「默认截断 + 手动展开」边界（50 / 51 / 5000 / 5001 / 50000）
 * 口径（需求 1）：首屏默认前 50 条，`total` 恒为**全量命中数**；「显示更多」每次 +50；
 *                展开到 5000 条停止并提示缩小条件（5000 只是展示上限，不再是一次性硬封顶）。
 * ⚠️ 边界值用法：恰好在阈值上的样本（50 / 5000）与超一格（51 / 5001）各一条 —— `>` 与 `>=`
 *    写错时至少一条会红，避免「用错阈值也全绿」。
 */

const KW = '找'

const makeTask = (index: number): TaskViewObject =>
    ({
        id: `t${String(index).padStart(6, '0')}`,
        userId: 'u1',
        parentTaskId: '',
        name: `找任务 ${index}`,
        description: '',
        state: 'todo',
        priority: 'low',
        startAt: '',
        endAt: '',
        projectId: '',
        tags: [],
        archivedAt: null,
        starMarkAt: null,
        givenUpAt: null,
        remindAt: null,
        remindRepeat: 'none',
        remindTime: null,
        remindWeekdays: [],
        isDeleted: false,
        isArchived: false,
        isStarMarked: false,
        isGivenUp: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
    }) as unknown as TaskViewObject

const makeTasks = (count: number): TaskViewObject[] =>
    Array.from({ length: count }, (_, index) => makeTask(index))

describe('T770 截断边界（恰好 50 / 51）', () => {
    it('恰好 50 条 + limit 50 ⇒ 全展示、truncated=false（不是「还有更多」）', () => {
        const page = searchTasksPage(makeTasks(50), KW, { limit: 50 })
        expect(page.total).toBe(50)
        expect(page.rows).toHaveLength(50)
        expect(page.truncated).toBe(false)
    })

    it('51 条 + limit 50 ⇒ 只展示 50、total 仍为 51、truncated=true', () => {
        const page = searchTasksPage(makeTasks(51), KW, { limit: 50 })
        expect(page.total).toBe(51)
        expect(page.rows).toHaveLength(50)
        expect(page.truncated).toBe(true)
    })
})

describe('T770 展示上限边界（恰好 5000 / 5001）', () => {
    it('恰好 5000 条 + limit 5000 ⇒ 全展示、truncated=false', () => {
        const page = searchTasksPage(makeTasks(5000), KW, { limit: 5000 })
        expect(page.total).toBe(5000)
        expect(page.rows).toHaveLength(5000)
        expect(page.truncated).toBe(false)
    })

    it('5001 条 + limit 5000 ⇒ 展示 5000、total 5001、truncated=true（提示缩小条件）', () => {
        const page = searchTasksPage(makeTasks(5001), KW, { limit: 5000 })
        expect(page.total).toBe(5001)
        expect(page.rows).toHaveLength(5000)
        expect(page.truncated).toBe(true)
    })
})

describe('T770 展开序列（+50 步长）保持前缀稳定', () => {
    it('50 → 100 → 150：每次多 50 行，且已展示部分顺序不变', () => {
        const tasks = makeTasks(150)
        const first = searchTasksPage(tasks, KW, { limit: 50 })
        const second = searchTasksPage(tasks, KW, { limit: 100 })
        const third = searchTasksPage(tasks, KW, { limit: 150 })
        expect(second.rows).toHaveLength(100)
        expect(third.rows).toHaveLength(150)
        expect(third.truncated).toBe(false)
        expect(second.rows.slice(0, 50).map((row) => row.task.id)).toEqual(
            first.rows.map((row) => row.task.id)
        )
        expect(third.rows.slice(0, 100).map((row) => row.task.id)).toEqual(
            second.rows.map((row) => row.task.id)
        )
    })

    it('未传 limit（全量调用）仍返回完整行（既有 searchTasks 语义不退化）', () => {
        const page = searchTasksPage(makeTasks(51), KW, {})
        expect(page.rows).toHaveLength(51)
        expect(page.truncated).toBe(false)
    })
})

describe('T770 5 万条：总数仍为全量命中数（不是「只数前 50」）', () => {
    it('limit 50 + 5 万条命中 ⇒ total=50000、rows=50、truncated=true', () => {
        const tasks = makeTasks(50_000)
        const page = searchTasksPage(tasks, KW, { limit: 50 })
        expect(page.total).toBe(50_000)
        expect(page.rows).toHaveLength(50)
        expect(page.truncated).toBe(true)
    })

    it('关键词不命中时 total=0、rows 为空（不误报）', () => {
        const page = searchTasksPage(makeTasks(1000), '不存在的词', { limit: 50 })
        expect(page.total).toBe(0)
        expect(page.rows).toHaveLength(0)
        expect(page.truncated).toBe(false)
    })
})

describe('T770 性能实测（5 万条本地数据，首屏 50 条）', () => {
    it('5 万条过滤+计数+排序+前 50 高亮 < 300ms（宽松阈值；数值输出到日志）', () => {
        const tasks = makeTasks(50_000)
        // 热身（避免首次 JIT/排序器初始化计入）
        searchTasksPage(tasks, KW, { limit: 50 })
        const startedAt = performance.now()
        const page = searchTasksPage(tasks, KW, { limit: 50 })
        const elapsed = performance.now() - startedAt
        // eslint-disable-next-line no-console
        console.log(
            `[T770 perf] 5 万条 → 总数 ${page.total} / 首屏 ${page.rows.length} 行: ${elapsed.toFixed(2)} ms`
        )
        // 判据一：只 materialize 展示窗口（一次性全量会在此红）
        expect(page.total).toBe(50_000)
        expect(page.rows).toHaveLength(50)
        // 判据二：计算段耗时远低于 1s 门槛（实测约 20~40ms，阈值留量）
        expect(elapsed).toBeLessThan(300)
    })

    it('四种非相关性排序在 5 万条下同样只算窗口（各 < 300ms）', () => {
        const tasks = makeTasks(50_000)
        const sorts = [
            { field: 'updatedAt', order: 'desc' },
            { field: 'dueAt', order: 'asc' },
            { field: 'priority', order: 'desc' },
            { field: 'name', order: 'asc' }
        ] as const
        for (const sort of sorts) {
            searchTasksPage(tasks, KW, { limit: 50, sort })
            const startedAt = performance.now()
            const page = searchTasksPage(tasks, KW, { limit: 50, sort })
            const elapsed = performance.now() - startedAt
            // eslint-disable-next-line no-console
            console.log(
                `[T770 perf] 5 万条 sort=${sort.field}:${sort.order} → ${elapsed.toFixed(2)} ms`
            )
            expect(page.rows).toHaveLength(50)
            expect(elapsed).toBeLessThan(300)
        }
    })
})