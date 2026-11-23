import { afterEach, describe, expect, it } from 'vite-plus/test'
import { setLocale } from '@nao-todo/shared/locales'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { searchTasks } from '../search-tasks'
import { DEFAULT_SEARCH_SORT, defaultOrderOf, type SearchSort } from '../search-sort'

/**
 * T770 · 搜索排序（五种字段 × 升降序）
 * 口径：相关性（默认，无方向）/ 更新时间 / 截止日 / 优先级 / 名称；后四者支持升/降。
 * 边界：空值（无截止日）恒排最后且不随方向翻转；同值以 id 升序收敛（引擎无关的稳定序）；
 *       名称按当前界面语言本地化比较（⛔ 裸 `<` 会被本地化用例判红）。
 */

const makeTask = (
    overrides: Partial<TaskViewObject> & Pick<TaskViewObject, 'id' | 'name'>
): TaskViewObject =>
    ({
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
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...overrides
    }) as unknown as TaskViewObject

/** 命中关键词统一用「找」；ids 顺序与名称顺序有意错开，避免「碰巧正确」 */
const KW = '找'

const ids = (tasks: TaskViewObject[], sort?: SearchSort): string[] =>
    searchTasks(tasks, KW, { sort }).map((row) => row.task.id)

afterEach(() => {
    setLocale('zh-CN')
})

describe('T770 默认排序 = 相关性（无方向）', () => {
    const tasks = [
        makeTask({ id: 'a', name: '无关事项', description: '备注里找得到' }),
        makeTask({ id: 'b', name: '找在开头' }),
        makeTask({ id: 'c', name: '后面才找' })
    ]

    it('缺省与「显式相关性」等价：名称命中 > 仅备注命中，同组按命中位置', () => {
        expect(ids(tasks)).toEqual(['b', 'c', 'a'])
        expect(ids(tasks, DEFAULT_SEARCH_SORT)).toEqual(['b', 'c', 'a'])
        expect(ids(tasks, { field: 'relevance', order: 'asc' })).toEqual(['b', 'c', 'a'])
        expect(ids(tasks, { field: 'relevance', order: 'desc' })).toEqual(['b', 'c', 'a'])
    })

    it('同相关度 → updatedAt 倒序 → 再 id 升序（稳定收敛，不随入参顺序抖动）', () => {
        const same = [
            makeTask({ id: 'z2', name: '找甲', updatedAt: '2026-02-01T00:00:00.000Z' }),
            makeTask({ id: 'z1', name: '找甲', updatedAt: '2026-02-01T00:00:00.000Z' }),
            makeTask({ id: 'z3', name: '找甲', updatedAt: '2026-03-01T00:00:00.000Z' })
        ]
        expect(ids(same)).toEqual(['z3', 'z1', 'z2'])
        expect(ids([...same].reverse())).toEqual(['z3', 'z1', 'z2'])
    })
})

describe('T770 更新时间排序（升/降）', () => {
    const tasks = [
        makeTask({ id: 'old', name: '找旧', updatedAt: '2026-01-01T00:00:00.000Z' }),
        makeTask({ id: 'new', name: '找新', updatedAt: '2026-06-01T00:00:00.000Z' }),
        makeTask({ id: 'mid', name: '找中', updatedAt: '2026-03-01T00:00:00.000Z' })
    ]

    it('降序（默认方向）= 最近更新在前', () => {
        expect(ids(tasks, { field: 'updatedAt', order: 'desc' })).toEqual(['new', 'mid', 'old'])
        expect(defaultOrderOf('updatedAt')).toBe('desc')
    })

    it('升序 = 最早更新在前；相同值以 id 升序', () => {
        expect(ids(tasks, { field: 'updatedAt', order: 'asc' })).toEqual(['old', 'mid', 'new'])
        const ties = [
            makeTask({ id: 'b', name: '找同', updatedAt: '2026-01-01T00:00:00.000Z' }),
            makeTask({ id: 'a', name: '找同', updatedAt: '2026-01-01T00:00:00.000Z' })
        ]
        expect(ids(ties, { field: 'updatedAt', order: 'asc' })).toEqual(['a', 'b'])
    })
})

describe('T770 截止日排序（升/降 + 空值恒最后）', () => {
    const tasks = [
        makeTask({ id: 'none', name: '找无期' }),
        makeTask({ id: 'late', name: '找晚', endAt: '2026-05-20T23:59:59.999Z' }),
        makeTask({ id: 'early', name: '找早', endAt: '2026-05-10T00:00:00.000Z' })
    ]

    it('升序（默认方向）= 最快到期在前，无截止日排最后', () => {
        expect(ids(tasks, { field: 'dueAt', order: 'asc' })).toEqual(['early', 'late', 'none'])
        expect(defaultOrderOf('dueAt')).toBe('asc')
    })

    it('降序 = 最晚到期在前，无截止日**仍排最后**（不随方向翻转）', () => {
        expect(ids(tasks, { field: 'dueAt', order: 'desc' })).toEqual(['late', 'early', 'none'])
    })

    it('非法/空 endAt 视为无截止日', () => {
        const broken = [
            makeTask({ id: 'bad', name: '找坏', endAt: 'not-a-date' }),
            makeTask({ id: 'ok', name: '找好', endAt: '2026-05-10T00:00:00.000Z' })
        ]
        expect(ids(broken, { field: 'dueAt', order: 'asc' })).toEqual(['ok', 'bad'])
    })
})

describe('T770 优先级排序（领域单一来源 prioritySNMap）', () => {
    const tasks = [
        makeTask({ id: 'l', name: '找低', priority: 'low' }),
        makeTask({ id: 'u', name: '找急', priority: 'urgent' }),
        makeTask({ id: 'm', name: '找中', priority: 'medium' }),
        makeTask({ id: 'h', name: '找高', priority: 'high' })
    ]

    it('降序（默认方向）= 紧急 → 高 → 中 → 低', () => {
        expect(ids(tasks, { field: 'priority', order: 'desc' })).toEqual(['u', 'h', 'm', 'l'])
        expect(defaultOrderOf('priority')).toBe('desc')
    })

    it('升序 = 低 → 中 → 高 → 紧急', () => {
        expect(ids(tasks, { field: 'priority', order: 'asc' })).toEqual(['l', 'm', 'h', 'u'])
    })

    it('白名单外脏值与 low 同档（不另写一份映射）', () => {
        const dirty = [
            makeTask({ id: 'dirty', name: '找脏', priority: '' }),
            makeTask({ id: 'medium', name: '找中', priority: 'medium' })
        ]
        expect(ids(dirty, { field: 'priority', order: 'asc' })).toEqual(['dirty', 'medium'])
    })
})

describe('T770 名称排序（当前界面语言本地化）', () => {
    /**
     * 中文按拼音：李(lǐ) < 张(zhāng)；而裸 `<` 比的是 UTF-16 码点（张 U+5F20 < 李 U+674E）
     * ⇒ 二者顺序相反，故本用例可杀死「换成裸 `<`」的变异。
     */
    const cjk = [makeTask({ id: 'zhang', name: '找张' }), makeTask({ id: 'li', name: '找李' })]

    it('zh-CN：按拼音升序（李 → 张），与码点序相反', () => {
        setLocale('zh-CN')
        // 反证：码点序确实是「张」在前（裸 `<` 会给出相反顺序）
        const codePointOrder: string[] = ['找张', '找李']
        expect(codePointOrder.sort()).toEqual(['找张', '找李'])
        expect(ids(cjk, { field: 'name', order: 'asc' })).toEqual(['li', 'zhang'])
    })

    it('zh-CN 降序为升序之反；同值以 id 升序收敛', () => {
        setLocale('zh-CN')
        expect(ids(cjk, { field: 'name', order: 'desc' })).toEqual(['zhang', 'li'])
        const ties = [makeTask({ id: 'b', name: '找同名' }), makeTask({ id: 'a', name: '找同名' })]
        expect(ids(ties, { field: 'name', order: 'asc' })).toEqual(['a', 'b'])
    })

    it('en-US：拉丁名称按字母序（大小写不敏感），切语言即时生效', () => {
        setLocale('en-US')
        const latin = [
            makeTask({ id: 'b', name: '找 Banana' }),
            makeTask({ id: 'a', name: '找 apple' }),
            makeTask({ id: 'c', name: '找 Cherry' })
        ]
        expect(ids(latin, { field: 'name', order: 'asc' })).toEqual(['a', 'b', 'c'])
        expect(ids(latin, { field: 'name', order: 'desc' })).toEqual(['c', 'b', 'a'])
    })

    it('数字按自然序（2 在 10 之前，非字典序）', () => {
        const numbered = [
            makeTask({ id: 'ten', name: '找第10章' }),
            makeTask({ id: 'two', name: '找第2章' })
        ]
        expect(ids(numbered, { field: 'name', order: 'asc' })).toEqual(['two', 'ten'])
    })
})

describe('T770 排序不改变命中集合（只改顺序）', () => {
    const tasks = [
        makeTask({ id: 'a', name: '找甲' }),
        makeTask({ id: 'b', name: '找乙', description: '备注找' }),
        makeTask({ id: 'c', name: '无关' }),
        makeTask({ id: 'd', name: '找丁', isArchived: true })
    ]
    const fields: SearchSort['field'][] = ['relevance', 'updatedAt', 'dueAt', 'priority', 'name']

    it('五种排序 × 两方向都只返回同一批命中（归档默认排除）', () => {
        for (const field of fields) {
            for (const order of ['asc', 'desc'] as const) {
                const got = ids(tasks, { field, order }).slice().sort()
                expect(got).toEqual(['a', 'b'])
            }
        }
    })
})