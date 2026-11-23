// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { GetTasksOptions } from '@nao-todo/shared'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { useTasksStore } from '@nao-todo/presentation/task'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import useSearchEngine, { DISPLAY_STEP, MAX_DISPLAY_ROWS, MAX_SCAN } from '../use-search'

/**
 * T770 · 搜索数据管线（加载 / 截断展开 / 排序 / 补拉预算）
 * 依据：Issue #373 用户口径 1、2、4 与 A 方案护栏 1、3。
 * 关键断言：
 *   ① 顶层扫描 = **单次大页**（limit=MAX_SCAN），不再多页小页（本地仓储每次 list 都整表读取解密）；
 *   ② 命中总数 = 全量命中数；展示窗口默认 50、「显示更多」+50、到 5000 停；
 *   ③ 排序切换后重算并把窗口复位到 50；
 *   ④ 子任务补拉超单轮时间预算即暂停（下轮继续），不会无界拖住搜索页。
 */

const hoisted = vi.hoisted(() => ({
    list: null as unknown as (options: GetTasksOptions) => Promise<unknown>,
    calls: [] as GetTasksOptions[]
}))

vi.mock('vue-router', () => ({
    useRoute: () => ({ query: {}, name: 'search' }),
    useRouter: () => ({ replace: vi.fn(async () => undefined) })
}))

vi.mock('@/hooks', () => ({
    useTaskUseCase: () => ({
        list: (options: GetTasksOptions) => hoisted.list(options)
    })
}))

/**
 * 每例任务 id 带「代际前缀」：`sessionCache` 是模块级单例且跨例保留已枚举父任务，
 * 复用同一批 id 会让后续用例「看起来已枚举」而空转 ⇒ 每例换一批 id 隔离。
 */
let generation = 0

const makeTask = (index: number, overrides: Partial<TaskViewObject> = {}): TaskViewObject =>
    ({
        id: `t${generation}-${String(index).padStart(5, '0')}`,
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
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...overrides
    }) as unknown as TaskViewObject

/** 顶层任务池（rootId 顺序 = 池顺序，模拟仓储 id asc 翻页） */
let roots: TaskViewObject[] = []
/** 子任务：父 id → 子任务池 */
let childrenOf: Map<string, TaskViewObject[]> = new Map()

/** 模拟仓储 list：按 options 过滤 + 分页（与本地仓储口径一致的最小实现） */
const fakeList = async (options: GetTasksOptions) => {
    hoisted.calls.push(options)
    const store = useTasksStore()
    const parentTaskId = options.parentTaskId ?? ''
    const pool = parentTaskId === '' ? roots : (childrenOf.get(parentTaskId) ?? [])
    const limit = options.limit ?? 20
    const page = options.page ?? 1
    const paged = pool.slice((page - 1) * limit, page * limit)
    store.addTasks(paged)
    return [
        {
            taskIds: paged.map((task) => task.id),
            pagination: { total: pool.length, page, limit, maxPage: Math.ceil(pool.length / limit) }
        },
        null
    ]
}

type Engine = ReturnType<typeof useSearchEngine>
let engine: Engine | null = null
let wrapper: VueWrapper | null = null

const mountEngine = async (): Promise<Engine> => {
    const Host = defineComponent({
        setup() {
            engine = useSearchEngine()
            return () => h('div')
        }
    })
    wrapper = mount(Host, {
        global: {
            provide: {
                [INDEX_VIEW_CONTEXT_KEY as symbol]: {
                    appSubscriber: { subscribe: vi.fn(), unsubscribe: vi.fn() },
                    showTaskDetails: vi.fn(),
                    getProjectName: () => ''
                }
            }
        }
    })
    // 等首拉（reloadRoots + 触顶探测）落定：sessionCache 是模块级单例，未落定会读到上一例的快照
    for (let i = 0; i < 4; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0))
        await nextTick()
    }
    return engine!
}

/** 等本轮补拉结束（UI 态 enumerating 归位；避免与下一轮竞态） */
const settleEnumeration = async () => {
    for (let i = 0; i < 200; i++) {
        await new Promise((resolve) => setTimeout(resolve, 5))
        if (!engine!.enumerating.value) return
    }
}

/** 关键词写入 → 推进 200ms 去抖（真实定时器）→ 等补拉本轮结束 */
const typeKeyword = async (value: string) => {
    engine!.writeKeyword(value)
    await new Promise((resolve) => setTimeout(resolve, 260))
    await nextTick()
    await settleEnumeration()
}

const rootCalls = () => hoisted.calls.filter((call) => (call.parentTaskId ?? '') === '')

beforeEach(() => {
    generation += 1
    setActivePinia(createPinia())
    hoisted.calls = []
    hoisted.list = fakeList
    roots = []
    childrenOf = new Map()
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    engine = null
    vi.useRealTimers()
})

describe('T770 加载：顶层单次大页扫描（护栏 1）', () => {
    it('5 万条以内：顶层只调用 1 次 list，且以 limit=MAX_SCAN / page=1 拉取', async () => {
        roots = Array.from({ length: 120 }, (_, index) => makeTask(index))
        await mountEngine()
        expect(rootCalls()).toHaveLength(1)
        expect(rootCalls()[0]!.limit).toBe(MAX_SCAN)
        expect(rootCalls()[0]!.page).toBe(1)
        expect(engine!.rootCount.value).toBe(120)
        expect(engine!.capped.value).toBe(false)
    })

    it('超过 MAX_SCAN：追加 1 次触顶探测（limit=1 / page=2）并置 capped', async () => {
        roots = Array.from({ length: MAX_SCAN + 1 }, (_, index) => makeTask(index))
        await mountEngine()
        const calls = rootCalls()
        expect(calls).toHaveLength(2)
        expect(calls[0]!.limit).toBe(MAX_SCAN)
        expect(calls[1]).toMatchObject({ limit: 1, page: 2 })
        expect(engine!.capped.value).toBe(true)
        expect(engine!.rootCount.value).toBe(MAX_SCAN)
    })
})

describe('T770 截断与展开（默认 50 / +50 / 到 5000 停）', () => {
    it('总数是全量命中数，首屏只渲染 50 行；「显示更多」每次 +50', async () => {
        roots = Array.from({ length: 120 }, (_, index) => makeTask(index))
        await mountEngine()
        await typeKeyword('找')
        expect(engine!.resultCount.value).toBe(120)
        expect(engine!.rows.value).toHaveLength(DISPLAY_STEP)
        expect(engine!.hasMore.value).toBe(true)

        engine!.showMore()
        await nextTick()
        expect(engine!.rows.value).toHaveLength(100)
        expect(engine!.hasMore.value).toBe(true)

        engine!.showMore()
        await nextTick()
        expect(engine!.rows.value).toHaveLength(120)
        expect(engine!.hasMore.value).toBe(false)
        expect(engine!.reachedDisplayCap.value).toBe(false)
    })

    it('命中数恰好 50：无「显示更多」；51 才有', async () => {
        roots = Array.from({ length: 50 }, (_, index) => makeTask(index))
        await mountEngine()
        await typeKeyword('找')
        expect(engine!.rows.value).toHaveLength(50)
        expect(engine!.hasMore.value).toBe(false)

        roots = Array.from({ length: 51 }, (_, index) => makeTask(index))
        hoisted.calls = []
        await mountEngine()
        await typeKeyword('找')
        expect(engine!.resultCount.value).toBe(51)
        expect(engine!.rows.value).toHaveLength(50)
        expect(engine!.hasMore.value).toBe(true)
    })

    it('超过 5000：展开到 5000 即停（hasMore=false、reachedDisplayCap=true）', async () => {
        roots = Array.from({ length: 5001 }, (_, index) => makeTask(index))
        await mountEngine()
        await typeKeyword('找')
        expect(engine!.resultCount.value).toBe(5001)
        for (let i = 0; i < 120; i++) engine!.showMore()
        await nextTick()
        expect(engine!.rows.value).toHaveLength(MAX_DISPLAY_ROWS)
        expect(engine!.hasMore.value).toBe(false)
        expect(engine!.reachedDisplayCap.value).toBe(true)
        expect(engine!.visibleLimit.value).toBe(MAX_DISPLAY_ROWS)
    })

    it('条件变化（排序/关键词）后窗口复位到 50', async () => {
        roots = Array.from({ length: 120 }, (_, index) => makeTask(index))
        await mountEngine()
        await typeKeyword('找')
        engine!.showMore()
        await nextTick()
        expect(engine!.visibleLimit.value).toBe(100)

        engine!.selectSortField('name')
        await nextTick()
        expect(engine!.visibleLimit.value).toBe(DISPLAY_STEP)
        expect(engine!.rows.value).toHaveLength(DISPLAY_STEP)
    })
})

describe('T770 排序与时间筛选接线', () => {
    it('切换排序后重算顺序（名称升序 vs 更新时间倒序）', async () => {
        roots = [
            makeTask(1, { name: '找甲', updatedAt: '2026-01-01T00:00:00.000Z' }),
            makeTask(2, { name: '找乙', updatedAt: '2026-06-01T00:00:00.000Z' })
        ]
        await mountEngine()
        await typeKeyword('找')
        // 默认相关性：同命中位置时 updatedAt 倒序 ⇒ 更新的「找乙」在前
        expect(engine!.rows.value.map((row) => row.task.name)).toEqual(['找乙', '找甲'])

        // 名称升序（拼音 甲 jiǎ < 乙 yǐ）⇒ 与相关性顺序相反
        engine!.selectSortField('name')
        await nextTick()
        expect(engine!.rows.value.map((row) => row.task.name)).toEqual(['找甲', '找乙'])

        engine!.selectSortOrder('desc')
        await nextTick()
        expect(engine!.rows.value.map((row) => row.task.name)).toEqual(['找乙', '找甲'])

        // 相关性无方向 ⇒ 选方向不改变状态
        engine!.selectSortField('relevance')
        await nextTick()
        engine!.selectSortOrder('asc')
        await nextTick()
        expect(engine!.sort.value).toEqual({ field: 'relevance', order: 'desc' })
    })

    it('截止日区间生效时排除无截止日；清空后恢复；filtersActive 随区间亮起', async () => {
        roots = [
            makeTask(1, { name: '找有期', endAt: new Date(2026, 2, 15, 12).toISOString() }),
            makeTask(2, { name: '找无期' })
        ]
        await mountEngine()
        await typeKeyword('找')
        expect(engine!.resultCount.value).toBe(2)
        expect(engine!.filtersActive.value).toBe(false)

        engine!.setDueFrom('2026-03-01')
        engine!.setDueTo('2026-03-31')
        await nextTick()
        expect(engine!.resultCount.value).toBe(1)
        expect(engine!.rows.value[0]!.task.name).toBe('找有期')
        expect(engine!.filtersActive.value).toBe(true)

        engine!.includeNoDue.value = true
        await nextTick()
        expect(engine!.resultCount.value).toBe(2)

        engine!.clearFilters()
        await nextTick()
        expect(engine!.filtersActive.value).toBe(false)
        expect(engine!.dueFrom.value).toBe('')
        expect(engine!.includeNoDue.value).toBe(false)
        expect(engine!.resultCount.value).toBe(2)
    })
})

describe('T770 子任务补拉时间预算（护栏 3）', () => {
    it('超预算即停（本轮只补一部分）+ 置暂停标记；再次输入关键词继续补齐', async () => {
        // 5 个顶层父任务，各 1 个子任务；每次子查询「耗时」6s（可控时钟），预算 10s
        roots = Array.from({ length: 5 }, (_, index) => {
            const parent = makeTask(index)
            childrenOf.set(parent.id, [makeTask(100 + index, { parentTaskId: parent.id })])
            return parent
        })
        let fakeNow = Date.parse('2026-01-01T00:00:00.000Z')
        const clockSpy = vi.spyOn(Date, 'now').mockImplementation(() => fakeNow)
        const slowList = async (options: GetTasksOptions) => {
            // 子查询推进可控时钟（模拟大数据下「每父一次整表读取」的耗时）
            if ((options.parentTaskId ?? '') !== '') fakeNow += 6000
            return fakeList(options)
        }
        hoisted.list = slowList

        await mountEngine()
        expect(engine!.rootCount.value).toBe(5)

        const childCalls = () =>
            hoisted.calls.filter((call) => (call.parentTaskId ?? '') !== '').length

        await typeKeyword('找')

        const firstRound = childCalls()

        expect(firstRound).toBeGreaterThan(0)
        expect(firstRound).toBeLessThan(5) // 预算用尽 ⇒ 本轮未补完
        expect(engine!.enumBudgetPaused.value).toBe(true)
        expect(engine!.enumerating.value).toBe(false)

        // 再次输入关键词 ⇒ 继续补齐剩余父任务（未枚举者仍在 missing 集合，逐轮递进）
        const before = childCalls()
        await typeKeyword('找任务')
        expect(childCalls()).toBeGreaterThan(before) // 下一轮确实继续（不是「永久卡住」）

        // 继续输入直到补齐（每轮受同一预算约束）
        let rounds = 0
        while (childCalls() < 5 && rounds < 5) {
            await typeKeyword(`找任务${rounds}`)
            rounds++
        }
        expect(childCalls()).toBe(5)
        expect(rounds).toBeLessThan(5)

        clockSpy.mockRestore()
    })
})