import { describe, expect, it } from 'vite-plus/test'
import type { TaskViewObject } from '@nao-todo/domain-task'
import {
    highlightSegments,
    searchTasks,
    dateKeyLabel,
    isTaskHit,
    isRateLimitError,
    retryDelayFor,
    RATE_MAX_ATTEMPTS,
    RATE_PAUSE_THRESHOLD
} from '../search-tasks'
import { matchTaskFilters, type SearchFilterSet } from '../search-tasks'

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
    it('名称行携带分段；描述为空 → 描述行 null（不占行）', () => {
        const row = searchTasks([makeTask({ id: 't1', name: '买菜清单' })], '菜')[0]!
        expect(row.nameSegments).toEqual([
            { text: '买', hit: false },
            { text: '菜', hit: true },
            { text: '清单', hit: false }
        ])
        expect(row.descriptionSegments).toBeNull()
    })
    it('SEA-D2-1 恒显：有描述但未命中关键词 → 整段纯文本（非 null、hit=false）', () => {
        const row = searchTasks(
            [makeTask({ id: 't1', name: '买菜', description: '周末去超市采购生活用品' })],
            '买菜'
        )[0]!
        expect(row.descriptionSegments).not.toBeNull()
        expect(row.descriptionSegments).toEqual([{ text: '周末去超市采购生活用品', hit: false }])
    })
    it('SEA-D2-1 恒显：描述命中关键词 → 高亮窗口仍生效', () => {
        const row = searchTasks(
            [makeTask({ id: 't1', name: '买菜', description: '记得去超市买鸡蛋和牛奶' })],
            '超市'
        )[0]!
        expect(row.descriptionSegments).not.toBeNull()
        expect(row.descriptionSegments!.some((s) => s.hit && s.text === '超市')).toBe(true)
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

describe('限流识别与退避调度（10051 / 429 家族）', () => {
    it('识别业务码与文案特征', () => {
        expect(isRateLimitError('请求过于频繁，请稍后再试')).toBe(true)
        expect(isRateLimitError('code 10051')).toBe(true)
        expect(isRateLimitError('10051 限流')).toBe(true)
        expect(isRateLimitError('任务不存在')).toBe(false)
        expect(isRateLimitError('网络错误，请检查您的网络连接')).toBe(false)
    })
    it('退避指数递增并封顶 ~15s（固定抖动 0 便于断言）', () => {
        const zero = () => 0
        const delays = [0, 1, 2, 3, 4].map((a) => retryDelayFor(a, 15_000, zero))
        expect(delays).toEqual([1000, 2000, 4000, 8000, 15000])
    })
    it('抖动不越过封顶', () => {
        const one = () => 1 // 最大抖动
        expect(retryDelayFor(0, 15_000, one)).toBeLessThanOrEqual(15_000)
        expect(retryDelayFor(3, 15_000, one)).toBeLessThanOrEqual(15_000)
    })
    it('常量语义：最多尝试 5 次、连续 3 次暂停', () => {
        expect(RATE_MAX_ATTEMPTS).toBe(5)
        expect(RATE_PAUSE_THRESHOLD).toBe(3)
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
describe('matchTaskFilters - SEA-03 结构化筛选（纯函数）', () => {
    const make = (o: Partial<TaskViewObject> & { id: string; name: string }) => makeTask(o)
    it('SEA-3-4a 空数组=不限（默认含已完成/收件箱）', () => {
        const none: SearchFilterSet = { projectIds: [], tagIds: [], priorities: [], states: [] }
        const tasks = [
            make({ id: 'a', name: 'x', state: 'done', projectId: '' }),
            make({ id: 'b', name: 'y', projectId: 'p1' })
        ]
        expect(tasks.filter((tt) => matchTaskFilters(tt, none))).toHaveLength(2)
    })
    it('SEA-3-4b 收件箱哨兵：projectId="" 与 null 均命中哨兵、p1 不命中', () => {
        const inbox: SearchFilterSet = { projectIds: [''], tagIds: [], priorities: [], states: [] }
        const t1 = make({ id: 'a', name: 'x', projectId: '' })
        const t2 = make({ id: 'b', name: 'y', projectId: null as unknown as string })
        const t3 = make({ id: 'c', name: 'z', projectId: 'p1' })
        expect(matchTaskFilters(t1, inbox)).toBe(true)
        expect(matchTaskFilters(t2, inbox)).toBe(true)
        expect(matchTaskFilters(t3, inbox)).toBe(false)
    })
    it('SEA-3-4c 标签维内 OR：任务标签任一命中即过', () => {
        const f: SearchFilterSet = {
            projectIds: [],
            tagIds: ['t2', 't3'],
            priorities: [],
            states: []
        }
        const t1 = make({ id: 'a', name: 'x', tags: ['t1', 't2'] })
        const t2 = make({ id: 'b', name: 'y', tags: ['t9'] })
        expect(matchTaskFilters(t1, f)).toBe(true)
        expect(matchTaskFilters(t2, f)).toBe(false)
    })
    it('SEA-3-4d 优先级/状态 OR 多选', () => {
        const prio: SearchFilterSet = {
            projectIds: [],
            tagIds: [],
            priorities: ['high', 'medium'],
            states: []
        }
        expect(matchTaskFilters(make({ id: 'a', name: 'x', priority: 'medium' }), prio)).toBe(true)
        expect(matchTaskFilters(make({ id: 'b', name: 'y', priority: 'low' }), prio)).toBe(false)
        const states: SearchFilterSet = {
            projectIds: [],
            tagIds: [],
            priorities: [],
            states: ['todo', 'done']
        }
        expect(matchTaskFilters(make({ id: 'c', name: 'z', state: 'done' }), states)).toBe(true)
        expect(matchTaskFilters(make({ id: 'd', name: 'w', state: 'in-progress' }), states)).toBe(
            false
        )
    })
    it('SEA-3-4e 维间 AND：四维同时限定全中才过', () => {
        const f: SearchFilterSet = {
            projectIds: ['p1'],
            tagIds: ['t1'],
            priorities: ['high'],
            states: ['todo']
        }
        const pass = make({
            id: 'ok',
            name: 'k',
            projectId: 'p1',
            tags: ['t1', 't2'],
            priority: 'high',
            state: 'todo'
        })
        const failTag = make({
            id: 'x',
            name: 'k',
            projectId: 'p1',
            tags: ['t3'],
            priority: 'high',
            state: 'todo'
        })
        const failState = make({
            id: 'y',
            name: 'k',
            projectId: 'p1',
            tags: ['t1'],
            priority: 'high',
            state: 'done'
        })
        expect(matchTaskFilters(pass, f)).toBe(true)
        expect(matchTaskFilters(failTag, f)).toBe(false)
        expect(matchTaskFilters(failState, f)).toBe(false)
    })
    it('SEA-3-8 过滤后排序规则不变（关键词相关度优先 + updatedAt 倒序）', () => {
        const f: SearchFilterSet = { projectIds: ['p1'], tagIds: [], priorities: [], states: [] }
        const descOnly = make({
            id: 'b',
            name: '杂项',
            description: '发布上线检查',
            projectId: 'p1',
            updatedAt: '2026-02-01T00:00:00.000Z'
        })
        const nameHitNewer = make({
            id: 'a',
            name: '上线检查',
            projectId: 'p1',
            updatedAt: '2026-03-01T00:00:00.000Z'
        })
        const other = make({
            id: 'c',
            name: '别的上线',
            projectId: 'p2',
            updatedAt: '2026-04-01T00:00:00.000Z'
        })
        const base = [other, descOnly, nameHitNewer]
        const filtered = base.filter((task) => matchTaskFilters(task, f))
        const ids = searchTasks(filtered, '上线').map((r) => r.task.id)
        expect(ids).toEqual(['a', 'b'])
    })
})

describe('性能实测（SEA-03：5000 行 + 四维组合过滤基准）', () => {
    it('5000 条 + 两维筛选过滤与排序 < 50ms（宽松断言 100ms，数值输出）', () => {
        const count = 5000
        const tasks: TaskViewObject[] = []
        for (let i = 0; i < count; i++) {
            const projectId = i % 5 === 0 ? '' : `p${i % 7}`
            tasks.push(
                makeTask({
                    id: `t${String(i).padStart(5, '0')}`,
                    name:
                        i % 3 === 0 ? `普通事项 ${i}` : `买菜${i % 2 === 0 ? '清单' : '安排'}${i}`,
                    description: i % 4 === 0 ? `备注里也写了买菜${i}、报销单据` : `杂项描述 ${i}`,
                    projectId,
                    tags: [`tag${i % 9}`, `tag${(i + 1) % 9}`],
                    priority: i % 4 === 0 ? 'high' : i % 4 === 1 ? 'medium' : 'low',
                    state: i % 6 === 0 ? 'done' : i % 6 === 1 ? 'in-progress' : 'todo',
                    updatedAt: new Date(2026, 0, 1, 0, 0, i % 60).toISOString()
                })
            )
        }
        const filters: SearchFilterSet = {
            projectIds: ['p2', ''],
            tagIds: ['tag3'],
            priorities: [],
            states: ['todo', 'done']
        }
        searchTasks(
            tasks.filter((task) => matchTaskFilters(task, filters)),
            '买菜'
        )
        const t0 = performance.now()
        const rows = searchTasks(
            tasks.filter((task) => matchTaskFilters(task, filters)),
            '买菜'
        )
        const elapsed = performance.now() - t0
        // eslint-disable-next-line no-console
        console.log(
            `[SEA-03 perf] ${count} 条四维组合过滤+排序+高亮: ${elapsed.toFixed(2)} ms（命中 ${rows.length} 条）`
        )
        expect(elapsed).toBeLessThan(100)
    })
})