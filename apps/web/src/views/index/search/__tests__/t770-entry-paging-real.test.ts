// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { GetTasksOptions } from '@nao-todo/shared'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { setLocale, t } from '@nao-todo/shared/locales'
import { useTasksStore } from '@nao-todo/presentation/task'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { nueUI } from '@/nue-ui-register'
import SearchEntry from '../entry.vue'

/**
 * T771 · 搜索页「首屏 50 / +50 展开」**真实管线**视图用例（Issue #373 口径 1）
 *
 * 为什么必须单独一个文件：`t770-entry-paging.test.ts` 用 `vi.mock` 把 `use-search` 整个换成了
 * 替身（行数来自测试自己的 ref）⇒ 那条用例只能证明「视图把引擎给的行画出来」，**杀不住**引擎侧
 * 窗口值/步长的任何变异（实测：`ref(DISPLAY_STEP)` → `ref(MAX_DISPLAY_ROWS)` 全绿）。
 * 本文件不 mock `use-search`：行数由**真实引擎 + 真实纯函数层**算出来后渲染，因此
 * 「窗口初值 / 步长」的变异必须让这里的断言变红。
 *
 * 关键设计 —— **夹具必须大于窗口**：200 条命中 vs 窗口 50/100/150，
 * 窗口值写错（5000）或多 1 条就立刻红；若夹具只有 50 条则「窗口 50」与「窗口 5000」无从区分。
 *
 * 关键词走 **URL 深链**（`route.query.q`）而不是键入：键入会触发引擎的「条件变化 ⇒ 窗口复位 50」
 * watch，把窗口初值彻底掩盖（这也是上一轮 `t770-engine` 变异漏网的机制），深链是唯一
 * 能观测到初值的用户路径（保存的常用搜索 / 最近搜索回访同样走它）。
 *
 * jsdom 不可测（留给用户视觉走查）：「显示更多」按钮位置/间距、展开时的滚动位置。
 */

const hoisted = vi.hoisted(() => ({
    calls: [] as GetTasksOptions[],
    routeQuery: {} as Record<string, string>
}))

vi.mock('vue-router', () => ({
    useRoute: () => ({ query: hoisted.routeQuery, name: 'search' }),
    useRouter: () => ({ replace: vi.fn(async () => undefined) })
}))

vi.mock('@/hooks', () => ({
    useTaskUseCase: () => ({ list: (options: GetTasksOptions) => fakeList(options) })
}))

/** 真实任务 store（引擎的数据来源），只替换与渲染无关的重型展示组件 */
vi.mock('@nao-todo/presentation/task', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@nao-todo/presentation/task')>()
    return {
        ...actual,
        TaskDetailsAdapter: { name: 'TaskDetailsAdapter', template: '<div class="slots-stub" />' },
        TaskTagBar: {
            name: 'TaskTagBar',
            props: ['availableTags', 'taskTagIds', 'readonly', 'small'],
            template: '<div class="tagbar-stub" />'
        }
    }
})

// 视图组合式：只剥离 stores/清单标签初始化（本用例考的是搜索管线与渲染，不是视图初始化）
vi.mock('../search-view', async () => {
    const { ref } = await import('vue')
    return {
        useSearchView: () => ({
            init: vi.fn(async () => undefined),
            isLoading: ref(false),
            error: ref(''),
            isDisplayAside: ref(true),
            switchDisplayAside: vi.fn(),
            savedSearch: {
                savedSearches: ref([]),
                add: vi.fn(),
                remove: vi.fn(),
                rename: vi.fn(),
                reorder: vi.fn()
            },
            searchHistory: {
                history: ref([]),
                record: vi.fn(),
                remove: vi.fn(),
                clear: vi.fn()
            }
        })
    }
})

vi.mock('@/components/search/aside', () => ({
    SearchAside: { name: 'SearchAside', template: '<div class="aside-stub" />' }
}))

/** 筛选栏替身（真实交互另有 search-filter-bar 用例覆盖；此处只需不打断渲染） */
vi.mock('@/components/search/search-filter-bar.vue', async () => {
    const { defineComponent } = await import('vue')
    return {
        default: defineComponent({
            name: 'SearchFilterBar',
            props: {
                sort: { type: Object, default: undefined },
                dueFrom: { type: String, default: '' },
                dueTo: { type: String, default: '' },
                includeNoDue: { type: Boolean, default: false }
            },
            template: '<div class="filter-bar-stub" />'
        })
    }
})

/** 每例任务 id 带代际前缀：`sessionCache` 是模块级单例，同 id 会让后续用例读到上一例快照 */
let generation = 0
/** 顶层任务池（模拟仓储 id asc 翻页） */
let roots: TaskViewObject[] = []

const makeTask = (index: number): TaskViewObject =>
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
        updatedAt: '2026-01-01T00:00:00.000Z'
    }) as unknown as TaskViewObject

/** 模拟仓储 list：按 parentTaskId 分流 + 分页（与本地仓储口径一致的最小实现） */
async function fakeList(options: GetTasksOptions) {
    hoisted.calls.push(options)
    const store = useTasksStore()
    const pool = (options.parentTaskId ?? '') === '' ? roots : []
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

let wrapper: VueWrapper | null = null

/** 挂载搜索页（真实引擎）并等首拉 + 子任务补拉落定 */
const mountEntry = async (): Promise<VueWrapper> => {
    wrapper = mount(SearchEntry, {
        global: {
            plugins: [nueUI],
            provide: {
                [INDEX_VIEW_CONTEXT_KEY as symbol]: {
                    appSubscriber: { subscribe: vi.fn(), unsubscribe: vi.fn() },
                    showTaskDetails: vi.fn(),
                    getProjectName: () => ''
                }
            }
        }
    })
    for (let i = 0; i < 4; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0))
        await nextTick()
    }
    return wrapper
}

/** 行元素（展示窗口的唯一可观测面） */
const rowsEl = () => wrapper!.findAll('.search-row')
/** 「显示更多」按钮（未出现 = 已无更多） */
const moreButton = () =>
    wrapper!.findAll('button.nue-button').find((button) => button.text().includes('显示更多'))
/** 「找到 N 条」文案 */
const countText = () => wrapper!.find('.srch-count').text()

/** 点一次「显示更多」并等渲染落定 */
const clickMore = async () => {
    await moreButton()!.trigger('click')
    await nextTick()
}

beforeEach(() => {
    generation += 1
    setActivePinia(createPinia())
    hoisted.calls = []
    roots = []
    hoisted.routeQuery = { q: '找' }
    setLocale('zh-CN')
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
})

describe('T771 真实管线：首屏 50 与逐级 +50（夹具 > 窗口，窗口写错即红）', () => {
    it('200 条命中：首屏恰 50 行、「找到 200 条」；点两次「显示更多」⇒ 100 / 150 行', async () => {
        roots = Array.from({ length: 200 }, (_, index) => makeTask(index))
        await mountEntry()

        // ① 首屏窗口（字面量 50：写死 5000 或改 25 都会红）
        expect(rowsEl()).toHaveLength(50)
        // ② 总数独立于窗口：显示全量命中数 200（不是渲染行数 50）
        expect(countText()).toBe(t('search.foundCount', { count: 200 }))
        expect(moreButton()).toBeTruthy()

        // ③ 第一级展开 ⇒ 恰 100（防「一次只 +N」或「点了不涨」）
        await clickMore()
        expect(rowsEl()).toHaveLength(100)
        expect(countText()).toBe(t('search.foundCount', { count: 200 }))

        // ④ 第二级展开 ⇒ 恰 150（防「只 +1 次就固化」的假实现）
        await clickMore()
        expect(rowsEl()).toHaveLength(150)
        expect(countText()).toBe(t('search.foundCount', { count: 200 }))

        // ⑤ 再点 ⇒ 仅剩的 200 条全部展示；无更多 ⇒ 按钮消失（未到 5000 上限 ⇒ 无到顶提示）
        await clickMore()
        expect(rowsEl()).toHaveLength(200)
        expect(moreButton()).toBeUndefined()
        expect(wrapper!.find('.search-more__cap').exists()).toBe(false)
    })

    it('51 条命中（不足一步）：首屏 50 行，展开一次补满 51 后按钮消失', async () => {
        roots = Array.from({ length: 51 }, (_, index) => makeTask(index))
        await mountEntry()

        expect(rowsEl()).toHaveLength(50)
        expect(countText()).toBe(t('search.foundCount', { count: 51 }))
        expect(moreButton()).toBeTruthy()

        await clickMore()
        expect(rowsEl()).toHaveLength(51)
        expect(moreButton()).toBeUndefined()
    })
})