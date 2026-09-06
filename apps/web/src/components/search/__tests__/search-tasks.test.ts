import { describe, expect, it } from 'vite-plus/test'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { highlightSegments, searchTasks, dateKeyLabel, isTaskHit } from '../search-tasks'

/** 构造最小任务 VO（默认顶层/未删除/未归档/未放弃；name 必填） */
const makeTask = (
    overrides: Partial<TaskViewObject> & Pick<TaskViewObject, 'id' | 'name'>
): TaskViewObject => {
    const defaults = {
        parentTaskId: '',
        userId: 'u1',
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
    } as unknown as Omit<TaskViewObject, 'name'>
    return { ...defaults, ...overrides } as TaskViewObject
}

describe('highlightSegments - 纯文本分段（禁 v-html 基础）', () => {
    it('命中段与非命中段正确切分（大小写不敏感、多次命中）', () => {
        expect(highlightSegments('写周报并写月报', '写')).toEqual([
            { text: '写', hit: true },
            { text: '周报并', hit: false },
            { text: '写', hit: true },
            { text: '月报', hit: false }
        ])
        expect(highlightSegments('Review PR', 'review')).toEqual([
            { text: 'Review', hit: true },
            { text: ' PR', hit: false }
        ])
    })
    it('空关键词/空文本边界', () => {
        expect(highlightSegments('abc', '   ')).toEqual([{ text: 'abc', hit: false }])
        expect(highlightSegments('', 'a')).toEqual([])
    })
})

describe('isTaskHit - 名称/备注子串', () => {
    it('名称命中', () => {
        expect(isTaskHit(makeTask({ id: 't1', name: '买菜' }), '菜')).toBe(true)
    })
    it('仅备注命中', () => {
        expect(
            isTaskHit(makeTask({ id: 't1', name: '日程', description: '去超市买菜' }), '超市')
        ).toBe(true)
    })
})

describe('searchTasks - 过滤', () => {
    it('空词返回空列表', () => {
        expect(searchTasks([makeTask({ id: 't1', name: '买菜' })], '  ')).toEqual([])
    })
    it('排除 deleted/archived/given-up', () => {
        const base = makeTask({ id: 't1', name: '买菜' })
        const tasks = [
            base,
            { ...base, id: 't2', isDeleted: true },
            { ...base, id: 't3', isArchived: true },
            { ...base, id: 't4', isGivenUp: true },
            { ...base, id: 't5', state: 'done' } // 已完成需保留
        ]
        const ids = searchTasks(tasks, '买菜').map((r) => r.task.id)
        expect(ids).toEqual(['t1', 't5'])
    })
    it('已删除父任务的子任务（防御）不参与', () => {
        const child = makeTask({ id: 'c1', name: '子任务买菜', parentTaskId: 'gone' })
        child.isDeleted = true
        expect(searchTasks([child], '买菜')).toEqual([])
    })
})

describe('searchTasks - 排序', () => {
    it('名称命中排在仅备注命中之前', () => {
        const nameHit = makeTask({
            id: 'a',
            name: '发布上线',
            description: '检查',
            updatedAt: '2026-01-01T00:00:00.000Z'
        })
        const descOnly = makeTask({
            id: 'b',
            name: '杂项',
            description: '记得发布上线检查',
            updatedAt: '2026-02-01T00:00:00.000Z'
        })
        const [first, second] = searchTasks([descOnly, nameHit], '上线')
        expect(first!.task.id).toBe('a')
        expect(second!.task.id).toBe('b')
    })
    it('组内短命中优先：命中位置靠前 > 名称更短；平局按 updatedAt 倒序', () => {
        const laterPos = makeTask({
            id: 'x',
            name: '准备发布上线事项',
            updatedAt: '2026-01-03T00:00:00.000Z'
        })
        const earlierPos = makeTask({
            id: 'y',
            name: '上线安排',
            updatedAt: '2026-01-01T00:00:00.000Z'
        })
        const samePosNewer = makeTask({
            id: 'z',
            name: '上线事项更新',
            updatedAt: '2026-02-01T00:00:00.000Z'
        })
        const samePosOlder = makeTask({
            id: 'w',
            name: '上线事项同款',
            updatedAt: '2026-01-01T00:00:00.000Z'
        })
        const ids = searchTasks([laterPos, earlierPos, samePosNewer, samePosOlder], '上线').map(
            (r) => r.task.id
        )
        // earlierPos(位置0,名称4字) → 同名长(6字)两组按 updatedAt 倒序 → laterPos(位置4)
        expect(ids[0]).toBe('y')
        expect(ids[1]).toBe('z')
        expect(ids[2]).toBe('w')
        expect(ids[3]).toBe('x')
    })
    it('名称+备注同时命中按名称组处理', () => {
        const both = makeTask({
            id: 'b1',
            name: '买菜做饭',
            description: '买菜清单',
            updatedAt: '2026-01-02T00:00:00.000Z'
        })
        const onlyName = makeTask({
            id: 'n1',
            name: '买菜',
            updatedAt: '2026-01-03T00:00:00.000Z'
        })
        const ids = searchTasks([both, onlyName], '买菜').map((r) => r.task.id)
        expect(ids).toEqual(['n1', 'b1']) // 同组：短命中（位置0）再名称短优先
    })
})

describe('searchTasks - 高亮分段与备注预览', () => {
    it('名称行携带分段；备注未命中为 null', () => {
        const row = searchTasks([makeTask({ id: 't1', name: '买菜清单' })], '菜')[0]!
        expect(row.nameSegments).toEqual([
            { text: '买', hit: false },
            { text: '菜', hit: true },
            { text: '清单', hit: false }
        ])
        expect(row.descriptionSegments).toBeNull()
    })
    it('备注命中提供截取窗口 + 省略号（窗口含命中、前后按需省略）', () => {
        const long = `这是很长的一段备注前面铺垫内容，${'甲'.repeat(60)}关键命中点买菜清单，${'乙'.repeat(80)}结尾`
        const row = searchTasks(
            [makeTask({ id: 't1', name: '事项', description: long })],
            '买菜'
        )[0]!
        expect(row.descriptionSegments).not.toBeNull()
        const segments = row.descriptionSegments!
        const texts = segments.map((s) => s.text)
        const joined = texts.join('')
        expect(joined).toContain('买菜')
        // 命中前内容足够长时前置省略号必现
        expect(texts[0]).toBe('…')
        // 窗口长度不超预览上限(+2 省略号)
        expect(joined.length).toBeLessThanOrEqual(122)
        // 高亮命中段被标记
        expect(segments.some((s) => s.hit && s.text.includes('买菜'))).toBe(true)
    })
})

describe('dateKeyLabel - 日期展示口径', () => {
    it('同年 M月D日、跨年含年份、空值边界', () => {
        expect(dateKeyLabel('2026-09-06', 2026)).toBe('9月6日')
        expect(dateKeyLabel('2025-12-31', 2026)).toBe('2025年12月31日')
        expect(dateKeyLabel('', 2026)).toBe('')
        expect(dateKeyLabel(null, 2026)).toBe('')
        expect(dateKeyLabel('not-a-date', 2026)).toBe('')
    })
})

describe('性能实测（5000 条本地过滤基准，供 SEA-01 汇报）', () => {
    it('5000 条过滤+排序 < 50ms（宽松断言 100ms，数据输出到日志）', () => {
        const count = 5000
        const tasks: TaskViewObject[] = []
        for (let i = 0; i < count; i++) {
            tasks.push(
                makeTask({
                    id: `t${String(i).padStart(5, '0')}`,
                    name:
                        i % 3 === 0 ? `普通事项 ${i}` : `买菜${i % 2 === 0 ? '清单' : '安排'}${i}`,
                    description: i % 4 === 0 ? `备注里也写了买菜${i}、报销单据` : `杂项描述 ${i}`,
                    updatedAt: new Date(2026, 0, 1, 0, 0, i % 60).toISOString()
                })
            )
        }
        // 热身
        searchTasks(tasks, '买菜')
        const t0 = performance.now()
        const hits = searchTasks(tasks, '买菜')
        const elapsed = performance.now() - t0
        // eslint-disable-next-line no-console
        console.log(
            `[SEA-01 perf] ${count} 条任务过滤+排序+高亮: ${elapsed.toFixed(2)} ms（命中 ${hits.length} 条）`
        )
        expect(elapsed).toBeLessThan(100)
        expect(hits.length).toBeGreaterThan(0)
    })
})