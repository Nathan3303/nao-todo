// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, type Ref } from 'vue'
import { setLocale } from '@nao-todo/shared/locales'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { nueUI } from '@/nue-ui-register'
import { DEFAULT_SEARCH_SORT, type SearchSort } from '@/components/search/search-sort'
import type { SearchRow } from '@/components/search/search-tasks'
import SearchEntry from '../entry.vue'

/**
 * T770 · 搜索页「默认截断 + 手动展开」与排序/区间接线（视图侧）
 * 依据：Issue #373 口径 1（默认 50 / +50 / 到 5000 停并提示）、口径 2/3（排序与区间状态由引擎持有）。
 * 断言口径：本文件把 `use-search` 整体换成替身（行数由测试自己的 ref 提供）⇒
 *          **只证明「视图把引擎给的行原样画出来、点击只调用引擎 showMore」**；
 *          ⛔ 不能证明窗口值/步长（替身里没有窗口）。首屏 50、逐级 +50 的**真实窗口语义**
 *          由 `t770-entry-paging-real.test.ts`（真实引擎 + 渲染行数）与 `t770-engine.test.ts` 守护。
 * jsdom 不可测（留给用户视觉走查）：按钮实际位置/间距、滚动加载观感。
 */

const hoisted = vi.hoisted(() => ({
    showMore: vi.fn(),
    selectSortField: vi.fn(),
    selectSortOrder: vi.fn(),
    setDueFrom: vi.fn(),
    setDueTo: vi.fn(),
    clearDueRange: vi.fn(),
    rows: null as unknown as Ref<SearchRow[]>,
    hasMore: null as unknown as Ref<boolean>,
    reachedDisplayCap: null as unknown as Ref<boolean>,
    resultCount: null as unknown as Ref<number>,
    sort: null as unknown as Ref<SearchSort>,
    dueFrom: null as unknown as Ref<string>,
    dueTo: null as unknown as Ref<string>,
    includeNoDue: null as unknown as Ref<boolean>
}))

vi.mock('@/components/search/use-search', async () => {
    const { ref } = await import('vue')
    hoisted.rows = ref([])
    hoisted.hasMore = ref(false)
    hoisted.reachedDisplayCap = ref(false)
    hoisted.resultCount = ref(0)
    hoisted.sort = ref<SearchSort>(DEFAULT_SEARCH_SORT)
    hoisted.dueFrom = ref('')
    hoisted.dueTo = ref('')
    hoisted.includeNoDue = ref(false)
    return {
        default: () => ({
            keyword: ref('找'),
            writeKeyword: vi.fn(),
            clearKeyword: vi.fn(),
            ready: ref(true),
            firstLoading: ref(false),
            error: ref(''),
            retry: vi.fn(),
            capped: ref(false),
            enumerating: ref(false),
            enumFailures: ref(0),
            enumRatePaused: ref(false),
            enumBudgetPaused: ref(false),
            rows: hoisted.rows,
            resultCount: hoisted.resultCount,
            hasMore: hoisted.hasMore,
            reachedDisplayCap: hoisted.reachedDisplayCap,
            showMore: hoisted.showMore,
            filterProjectIds: ref([]),
            filterTagIds: ref([]),
            filterPriorities: ref([]),
            filterStates: ref([]),
            includeArchived: ref(false),
            filtersActive: ref(false),
            sort: hoisted.sort,
            dueFrom: hoisted.dueFrom,
            dueTo: hoisted.dueTo,
            includeNoDue: hoisted.includeNoDue,
            selectSortField: hoisted.selectSortField,
            selectSortOrder: hoisted.selectSortOrder,
            setDueFrom: hoisted.setDueFrom,
            setDueTo: hoisted.setDueTo,
            clearDueRange: hoisted.clearDueRange,
            toggleProjectFilter: vi.fn(),
            toggleTagFilter: vi.fn(),
            togglePriorityFilter: vi.fn(),
            toggleStateFilter: vi.fn(),
            clearFilters: vi.fn(),
            queryState: ref({
                keyword: '',
                projectIds: [],
                tagIds: [],
                priorities: [],
                states: [],
                includeArchived: false
            }),
            applyQuery: vi.fn()
        })
    }
})

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

vi.mock('@nao-todo/presentation/task', async () => {
    const { ref } = await import('vue')
    return {
        TaskDetailsAdapter: { name: 'TaskDetailsAdapter', template: '<div />' },
        TaskPrioritySelectOptions: ref([]),
        TaskStateSelectOptions: ref([]),
        TaskTagBar: { name: 'TaskTagBar', template: '<div />' }
    }
})

vi.mock('@nao-todo/presentation/tag', () => ({
    useTagsStore: () => ({ tags: new Map(), getTag: () => undefined })
}))

vi.mock('@/components/search/aside', () => ({
    SearchAside: { name: 'SearchAside', template: '<div />' }
}))

/** 筛选栏替身：只声明 props/emits，便于断言接线（真实交互在 search-filter-bar 用例覆盖） */
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
            emits: [
                'selectSortField',
                'selectSortOrder',
                'update:dueFrom',
                'update:dueTo',
                'update:includeNoDue',
                'clearDue'
            ],
            template: '<div class="filter-bar-stub" />'
        })
    }
})

/** 便于在用例内定位替身（与 mock 内同名组件） */
const FilterBarStub = { name: 'SearchFilterBar' }

let wrapper: VueWrapper | null = null

const makeRow = (index: number): SearchRow =>
    ({
        task: {
            id: `t${index}`,
            name: `找任务 ${index}`,
            description: '',
            state: 'todo',
            priority: 'low',
            projectId: '',
            tags: [],
            startAt: '',
            endAt: '',
            isArchived: false
        },
        nameSegments: [{ text: `找任务 ${index}`, hit: true }],
        descriptionSegments: null,
        descriptionOnlyHit: false
    }) as unknown as SearchRow

const mountEntry = (): VueWrapper => {
    wrapper = mount(SearchEntry, {
        global: {
            plugins: [nueUI],
            provide: {
                [INDEX_VIEW_CONTEXT_KEY as symbol]: {
                    showTaskDetails: vi.fn(),
                    getProjectName: () => ''
                }
            }
        }
    })
    return wrapper
}

const rowsEl = () => wrapper!.findAll('.search-row')
const moreButton = () =>
    wrapper!.findAll('button.nue-button').find((button) => button.text().includes('显示更多'))

beforeEach(() => {
    vi.clearAllMocks()
    // 行数故意 < 窗口（3 行）：本文件断言的是「原样渲染」，与窗口大小无关
    hoisted.rows.value = Array.from({ length: 3 }, (_, index) => makeRow(index))
    hoisted.hasMore.value = true
    hoisted.reachedDisplayCap.value = false
    hoisted.resultCount.value = 5000
    hoisted.sort.value = DEFAULT_SEARCH_SORT
    hoisted.dueFrom.value = ''
    hoisted.dueTo.value = ''
    hoisted.includeNoDue.value = false
    setLocale('zh-CN')
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
})

describe('T770 视图侧：展示窗口与「显示更多」', () => {
    it('视图原样渲染引擎给的行（不裁剪、不自增窗口），「找到 N 条」显示全量命中数', () => {
        mountEntry()
        expect(rowsEl()).toHaveLength(3)
        expect(wrapper!.find('.srch-count').text()).toContain('5000')
    })

    it('还有更多 ⇒ 出现「显示更多」按钮；点击只调用引擎 showMore（单一真源）', async () => {
        mountEntry()
        const button = moreButton()
        expect(button).toBeTruthy()
        await button!.trigger('click')
        expect(hoisted.showMore).toHaveBeenCalledTimes(1)
        // 视图不自增窗口（渲染源始终来自引擎：替身不涨 ⇒ 行数不变）
        expect(rowsEl()).toHaveLength(3)
    })

    it('到展示上限 ⇒ 按钮消失、改为「结果过多，请缩小条件」提示', async () => {
        hoisted.hasMore.value = false
        hoisted.reachedDisplayCap.value = true
        mountEntry()
        expect(moreButton()).toBeUndefined()
        expect(wrapper!.find('.search-more__cap').text()).toBe('结果过多，请缩小条件')
    })

    it('无更多且未到上限 ⇒ 底部既无按钮也无提示', () => {
        hoisted.hasMore.value = false
        hoisted.reachedDisplayCap.value = false
        mountEntry()
        expect(moreButton()).toBeUndefined()
        expect(wrapper!.find('.search-more__cap').exists()).toBe(false)
    })
})

describe('T770 视图侧：排序 / 区间状态接线', () => {
    it('筛选栏收到引擎的排序与区间 props', async () => {
        hoisted.sort.value = { field: 'dueAt', order: 'desc' }
        hoisted.dueFrom.value = '2026-03-01'
        hoisted.dueTo.value = '2026-03-31'
        hoisted.includeNoDue.value = true
        mountEntry()
        const bar = wrapper!.findComponent(FilterBarStub)
        expect(bar.props('sort')).toEqual({ field: 'dueAt', order: 'desc' })
        expect(bar.props('dueFrom')).toBe('2026-03-01')
        expect(bar.props('dueTo')).toBe('2026-03-31')
        expect(bar.props('includeNoDue')).toBe(true)
    })

    it('筛选栏上抛的排序/区间事件回落到引擎方法（视图零业务逻辑）', async () => {
        mountEntry()
        const bar = wrapper!.findComponent(FilterBarStub)
        bar.vm.$emit('selectSortField', 'name')
        bar.vm.$emit('selectSortOrder', 'asc')
        bar.vm.$emit('update:dueFrom', '2026-04-01')
        bar.vm.$emit('update:dueTo', '2026-04-30')
        bar.vm.$emit('update:includeNoDue', true)
        bar.vm.$emit('clearDue')
        await nextTick()
        expect(hoisted.selectSortField).toHaveBeenCalledWith('name')
        expect(hoisted.selectSortOrder).toHaveBeenCalledWith('asc')
        expect(hoisted.setDueFrom).toHaveBeenCalledWith('2026-04-01')
        expect(hoisted.setDueTo).toHaveBeenCalledWith('2026-04-30')
        expect(hoisted.clearDueRange).toHaveBeenCalledTimes(1)
    })

    it('补拉超预算提示可见（结果较多时告知改关键词后继续）', async () => {
        mountEntry()
        expect(wrapper!.text()).not.toContain('子任务补拉已暂停')
    })
})