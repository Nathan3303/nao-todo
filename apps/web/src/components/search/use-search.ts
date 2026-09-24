import type { GetTasksOptions } from '@nao-todo/shared'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { computed, inject, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTaskUseCase } from '@/hooks'
import { useTasksStore } from '@nao-todo/presentation/task'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import {
    needsSearchQueryReExport,
    parseSearchQuery,
    serializeSearchQuery,
    type RawSearchQuery,
    type SearchQueryState
} from './search-query'
import {
    isRateLimitError,
    matchTaskFilters,
    retryDelayFor,
    RATE_MAX_ATTEMPTS,
    RATE_PAUSE_THRESHOLD,
    searchTasks
} from './search-tasks'

/**
 * 搜索数据管线组合式（SEA-01）
 * @description DI 组装入口：任务用例本地组装（不来自视图上下文）。
 *              - 顶层全量懒加载（分页游标 ≤5000，含默认容器/已完成；不含 deleted/archived/given-up）；
 *              - 会话缓存（模块级单例）：激活刷新后台换新（有旧数据期间不闪屏）；
 *              - 键入(200ms 去抖)时按父任务分块并发(4)补拉子任务归并缓存（方案 A 裁定）；
 *              - 未就绪期间输入的关键词在数据就绪后自动重放（结果 computed 依赖数据源自动重算）。
 */

// 会话级缓存（模块级单例，跨路由切换保留；浅响应以驱动 computed 重算）
type SearchCache = {
    rootIds: Set<string>
    /** 父任务 id → 已补拉的直接子任务 id 集合（归并缓存） */
    childIds: Map<string, Set<string>>
    /** 已完成枚举的父任务（含无子任务；失败不入列以便下次重试） */
    enumeratedParents: Set<string>
}

const sessionCache = shallowRef<SearchCache | null>(null)
/** 缓存内容变更计数：快照换新 / 子任务归并 / 增量新增后自增，驱动结果重算 */
const revision = ref(0)
const bumpRevision = () => {
    revision.value += 1
}

const PAGE_LIMIT = 100
/** 顶层全量上限（提示条口径：仅搜索前 5000 条） */
const MAX_ROWS = 5000
const MAX_ROOT_PAGES = Math.ceil(MAX_ROWS / PAGE_LIMIT)
/** 单父任务子任务枚举页数上限（防御；单层 UI 常态远小于此） */
const MAX_CHILD_PAGES = 10
/** 子任务补拉并发数（方案 A） */
const ENUMERATE_CONCURRENCY = 4
/** 限流暂停后自动恢复间隔 */
const RATE_PAUSE_RESUME_MS = 8_000

/** 等待毫秒 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** 顶层查询状态变体（单一刻度；布尔值均显式传入，避免后端/本地仓库默认口径差异） */
type RootStatusVariant = { isDeleted: boolean; isGivenUp: boolean }

/** 默认口径：未删除/未归档/未放弃 */
const ROOT_STATUS_VARIANTS_DEFAULT: RootStatusVariant[] = [{ isDeleted: false, isGivenUp: false }]

/** S7b 开启后：四象限并集 = 普通 + 已删除 + 已放弃（归档由 P2 `includeArchived` 单独控制） */
const ROOT_STATUS_VARIANTS_INCLUDED: RootStatusVariant[] = [
    { isDeleted: false, isGivenUp: false },
    { isDeleted: true, isGivenUp: false },
    { isDeleted: false, isGivenUp: true },
    { isDeleted: true, isGivenUp: true }
]

/** 顶层列表查询（含已完成；id asc 稳定翻页；删除/放弃按变体条件化；归档按 includeArchived，P2） */
export const buildRootQuery = (
    page: number,
    variant: RootStatusVariant,
    includeArchived: boolean
): GetTasksOptions => ({
    isDeleted: variant.isDeleted,
    ...(includeArchived ? { includeArchived: true } : { isArchived: false }),
    isGivenUp: variant.isGivenUp,
    sort: { field: 'id', order: 'asc' },
    limit: PAGE_LIMIT,
    page
})

/** 子任务列表查询（单父；同归档口径，P2） */
export const buildChildQuery = (
    parentTaskId: string,
    page: number,
    includeArchived: boolean
): GetTasksOptions => ({
    parentTaskId,
    isDeleted: false,
    ...(includeArchived ? { includeArchived: true } : { isArchived: false }),
    isGivenUp: false,
    sort: { field: 'id', order: 'asc' },
    limit: PAGE_LIMIT,
    page
})

const useSearchEngine = () => {
    // @viewContext 仅取 UI 级依赖（事件订阅）；业务用例下方本地组装
    const { appSubscriber } = inject(INDEX_VIEW_CONTEXT_KEY)!

    // @dataStore 与用例
    const tasksStore = useTasksStore()
    const taskUseCase = useTaskUseCase(tasksStore)

    // @url URL 深链（SEA-04 / S2）：URL query 为搜索状态唯一真源；进入时还原（D1 哨兵见 search-query）
    const route = useRoute()
    const router = useRouter()
    const initialState = parseSearchQuery(route.query as RawSearchQuery)

    // @states 视图状态
    const keyword = ref(initialState.keyword)
    const debouncedKeyword = ref(initialState.keyword.trim())
    const firstLoading = ref<boolean>(!sessionCache.value) // 首拉门（无缓存时整页加载）
    const refreshing = ref<boolean>(false) // 后台刷新（有缓存不闪屏）
    const error = ref('') // 拉取错误（重试出口）
    const capped = ref(false) // 顶层已达 5000 上限
    const enumerating = ref(false) // 子任务补拉中（顶部轻提示）
    const enumFailures = ref(0) // 本次补拉失败的父任务数（>0 时轻提示）
    const enumRatePaused = ref(false) // 枚举连续限流暂停（提示「限流，稍后自动重试」）

    // @states 结构化筛选（SEA-03：空数组=不过滤；收件箱=projectId ''；初值来自 URL）
    const filterProjectIds = ref<string[]>([...initialState.projectIds]) // 清单（含收件箱哨兵 ''）
    const filterTagIds = ref<string[]>([...initialState.tagIds]) // 标签
    const filterPriorities = ref<string[]>([...initialState.priorities]) // 优先级 high/medium/low
    const filterStates = ref<string[]>([...initialState.states]) // 状态 todo/in-progress/done
    const includeExcluded = ref<boolean>(initialState.includeExcluded) // S7b：纳入已删除/已放弃（archived 恒排除）
    const includeArchived = ref<boolean>(initialState.includeArchived) // P2：包含已归档（开 ⇒ 顶层/子任务均不过滤归档）

    let debounceTimer: ReturnType<typeof setTimeout> | undefined
    let reloadQueued = false
    let enumerateBusy = false
    let enumResumeTimer: ReturnType<typeof setTimeout> | undefined

    // @computed 顶层 + 子任务归并全量（渲染源；store map 变更自动联动）
    const flatTaskIds = computed<Set<string>>(() => {
        void revision.value // 缓存内容变更（换新/归并/增量）时重算
        const cache = sessionCache.value
        if (!cache) return new Set()
        const merged = new Set(cache.rootIds)
        cache.childIds.forEach((childSet) => childSet.forEach((id) => merged.add(id)))
        return merged
    })
    const flatTasks = computed<TaskViewObject[]>(() =>
        [...flatTaskIds.value]
            .map((id) => tasksStore.getTask(id))
            .filter((task): task is TaskViewObject => !!task)
            // Fix B：收集箱真实数据 `'inbox'` 归一为内部哨兵 `''`（不改 URL / 内建清单查询）
            .map((task) => (task.projectId === 'inbox' ? { ...task, projectId: '' } : task))
    )
    // @results 四维筛选（即时重算）→ 关键词 200ms 去抖 → 纯函数排序/高亮（未就绪输入就绪后自动重放）
    const rows = computed(() => {
        const base = flatTasks.value.filter((task) =>
            matchTaskFilters(task, {
                projectIds: filterProjectIds.value,
                tagIds: filterTagIds.value,
                priorities: filterPriorities.value,
                states: filterStates.value
            })
        )
        return searchTasks(base, debouncedKeyword.value, {
            includeExcluded: includeExcluded.value,
            includeArchived: includeArchived.value
        })
    })
    const resultCount = computed(() => rows.value.length)
    const filtersActive = computed(
        () =>
            filterProjectIds.value.length > 0 ||
            filterTagIds.value.length > 0 ||
            filterPriorities.value.length > 0 ||
            filterStates.value.length > 0
    )
    const rootCount = computed(() => sessionCache.value?.rootIds.size ?? 0)
    const ready = computed(() => !!sessionCache.value)

    // @method 关键词写入（200ms 去抖：仅延迟结果重算与子任务补拉；清空立即生效）
    const writeKeyword = (value: string) => {
        keyword.value = value
        if (debounceTimer) clearTimeout(debounceTimer)
        if (!value.trim()) {
            debouncedKeyword.value = ''
            return
        }
        debounceTimer = setTimeout(() => {
            debouncedKeyword.value = value
            void ensureChildrenOnce()
        }, 200)
    }

    // @method 清空关键词（立即重置）
    const clearKeyword = () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        keyword.value = ''
        debouncedKeyword.value = ''
    }

    // @method 单值切换（维内多选；再点取消）
    const toggleIn = (arr: Ref<string[]>, id: string) => {
        const index = arr.value.indexOf(id)
        if (index >= 0) arr.value.splice(index, 1)
        else arr.value.push(id)
    }
    const toggleProjectFilter = (id: string) => toggleIn(filterProjectIds, id)
    const toggleTagFilter = (id: string) => toggleIn(filterTagIds, id)
    const togglePriorityFilter = (id: string) => toggleIn(filterPriorities, id)
    const toggleStateFilter = (id: string) => toggleIn(filterStates, id)

    // @method 一键清空全部筛选（恢复默认：不限，含已完成）
    const clearFilters = () => {
        filterProjectIds.value = []
        filterTagIds.value = []
        filterPriorities.value = []
        filterStates.value = []
    }

    /**
     * 列表调用（限流退避重试：指数+抖动，最多 RATE_MAX_ATTEMPTS 次后上抛；期间不叠加新请求）
     * @description 退避在单请求内串行等待；外层 reload/enumerate 各自合并，不会堆叠请求
     */
    const callList = async (options: GetTasksOptions) => {
        for (let attempt = 0; ; attempt++) {
            const [res, err] = await taskUseCase.list(options)
            if (err === null) return res
            const message = typeof err === 'string' ? err : String(err)
            if (isRateLimitError(message) && attempt + 1 < RATE_MAX_ATTEMPTS) {
                await sleep(retryDelayFor(attempt))
                continue
            }
            throw err
        }
    }

    /** 分页拉取单个状态变体到集合；穷尽或触顶探测后设置 capped */
    const sweepRootVariantInto = async (
        target: Set<string>,
        variant: RootStatusVariant,
        includeArchived: boolean
    ): Promise<void> => {
        let exhausted = false
        for (let page = 1; page <= MAX_ROOT_PAGES; page++) {
            const res = await callList(buildRootQuery(page, variant, includeArchived))
            res.taskIds.forEach((id) => target.add(id))
            if (res.taskIds.length < PAGE_LIMIT) {
                exhausted = true
                break
            }
            const maxPage = res.pagination?.maxPage ?? page
            if (page >= maxPage) {
                exhausted = true
                break
            }
            if (target.size >= MAX_ROWS) break
        }
        if (!exhausted && target.size >= MAX_ROWS) {
            // 触顶探测：再取 1 条判断是否仍有数据（精确「仅搜索前 5000 条」提示）；探测失败不阻塞已拉取结果
            try {
                const [probeRes, probeErr] = await taskUseCase.list(
                    buildRootQuery(MAX_ROOT_PAGES + 1, variant, includeArchived)
                )
                if (probeErr === null && probeRes.taskIds.length > 0) capped.value = true
            } catch {
                /* 忽略探测错误：5000 条快照已可用 */
            }
        }
    }

    /** 分页拉取顶层到集合（S7b：开启时四象限并集；P2：includeArchived 时纳入归档） */
    const sweepRootsInto = async (
        target: Set<string>,
        includeExcluded: boolean,
        includeArchived: boolean
    ): Promise<void> => {
        capped.value = false
        const variants = includeExcluded
            ? ROOT_STATUS_VARIANTS_INCLUDED
            : ROOT_STATUS_VARIANTS_DEFAULT
        for (const variant of variants) {
            if (target.size >= MAX_ROWS) break
            await sweepRootVariantInto(target, variant, includeArchived)
        }
    }

    /** 单父任务子任务补拉（失败抛出，由并发池计数；成功标记已枚举） */
    const loadChildrenOf = async (parentId: string): Promise<void> => {
        const cache = sessionCache.value
        if (!cache || cache.enumeratedParents.has(parentId)) return
        const childSet = new Set<string>()
        for (let page = 1; page <= MAX_CHILD_PAGES; page++) {
            const res = await callList(buildChildQuery(parentId, page, includeArchived.value))
            res.taskIds.forEach((id) => childSet.add(id))
            const maxPage = res.pagination?.maxPage ?? page
            if (res.taskIds.length < PAGE_LIMIT || page >= maxPage) break
        }
        cache.childIds.set(parentId, childSet)
        cache.enumeratedParents.add(parentId)
        bumpRevision() // 归并完成 → 子任务行并入结果
    }

    /** 子任务补拉（仅一次飞行；父集合缺失者；单父失败计数留待下次关键词重试） */
    const ensureChildrenOnce = async (): Promise<void> => {
        const cache = sessionCache.value
        if (!cache || debouncedKeyword.value.trim() === '' || enumerateBusy) return
        enumerateBusy = true
        enumerating.value = true
        enumFailures.value = 0
        enumRatePaused.value = false
        if (enumResumeTimer) {
            clearTimeout(enumResumeTimer)
            enumResumeTimer = undefined
        }
        try {
            const missing = [...cache.rootIds].filter((id) => !cache.enumeratedParents.has(id))
            if (missing.length === 0) return
            let consecutiveRate = 0
            let abort = false
            let cursor = 0
            const size = Math.min(ENUMERATE_CONCURRENCY, missing.length)
            const run = async (): Promise<void> => {
                while (cursor < missing.length && !abort) {
                    const parentId = missing[cursor]!
                    cursor++
                    try {
                        await loadChildrenOf(parentId)
                        consecutiveRate = 0
                    } catch (err) {
                        const message = typeof err === 'string' ? err : String(err)
                        if (isRateLimitError(message)) {
                            consecutiveRate += 1
                            if (consecutiveRate >= RATE_PAUSE_THRESHOLD) abort = true
                        } else {
                            enumFailures.value += 1
                        }
                    }
                }
            }
            await Promise.all(Array.from({ length: size }, () => run()))
            if (abort) {
                enumRatePaused.value = true
                enumResumeTimer = setTimeout(() => {
                    enumResumeTimer = undefined
                    void ensureChildrenOnce()
                }, RATE_PAUSE_RESUME_MS)
            }
        } finally {
            enumerateBusy = false
            enumerating.value = false
        }
    }

    // @computed 当前查询状态（URL 同步 / 保存常用搜索的统一投影）
    const queryState = computed<SearchQueryState>(() => ({
        keyword: keyword.value,
        projectIds: filterProjectIds.value,
        tagIds: filterTagIds.value,
        priorities: filterPriorities.value,
        states: filterStates.value,
        includeExcluded: includeExcluded.value,
        includeArchived: includeArchived.value
    }))
    // @url 状态 → URL（replace 不污染后退栈 D2；空值省略；等价则短路避免回环）
    const writeQueryToUrl = () => {
        const local = queryState.value
        if (!needsSearchQueryReExport(local, route.query as RawSearchQuery)) return
        void router.replace({ query: serializeSearchQuery(local) })
    }
    watch(keyword, writeQueryToUrl)
    watch(
        [
            filterProjectIds,
            filterTagIds,
            filterPriorities,
            filterStates,
            includeExcluded,
            includeArchived
        ],
        writeQueryToUrl,
        { deep: true }
    )
    // @url 本地状态为真源（SEA-04-DEF-02 B 方案）：路由 query 变化时仅对账再导出，
    //      覆盖 closeDetails / switchTaskDetails / after-close 等丢 query 的导航；
    //      绝不反向导入清空本地状态（深链还原只在 setup 期由 initialState 完成）。
    watch(
        () => route.query,
        () => {
            if (route.name !== 'search') return
            writeQueryToUrl()
        }
    )

    /**
     * 应用完整查询状态（常用搜索复现）
     * @description 统一写入各 ref（关键词走 writeKeyword 以复用去抖与子任务补拉），
     *              由既有 watch 负责 URL 同步与结果重算；避免 UI 层逐字段 set。
     * @param state 目标查询状态
     */
    const applyQuery = (state: SearchQueryState) => {
        writeKeyword(state.keyword)
        filterProjectIds.value = [...state.projectIds]
        filterTagIds.value = [...state.tagIds]
        filterPriorities.value = [...state.priorities]
        filterStates.value = [...state.states]
        includeExcluded.value = state.includeExcluded
        includeArchived.value = state.includeArchived
    }

    /**
     * 顶层快照重拉（激活/刷新/重试统一出口；运行中合并防连点）
     * @description 无缓存 → 门禁加载；有缓存 → 后台换新集合（期间旧数据继续渲染，不闪屏）
     */
    const reloadRoots = async (): Promise<void> => {
        if (reloadQueued) return
        reloadQueued = true
        try {
            const nextIds = new Set<string>()
            try {
                await sweepRootsInto(nextIds, includeExcluded.value, includeArchived.value)
            } catch (err) {
                error.value = typeof err === 'string' ? err : String(err)
                refreshing.value = false
                if (!sessionCache.value) firstLoading.value = false
                return
            }
            // 会话缓存延续：仍存在的父任务子任务快照与枚举标记保留（重复关键词零补拉）
            const prevCache = sessionCache.value
            const carryChildIds = new Map<string, Set<string>>()
            const carryEnumerated = new Set<string>()
            if (prevCache) {
                prevCache.childIds.forEach((childSet, parentId) => {
                    if (nextIds.has(parentId) && prevCache.enumeratedParents.has(parentId)) {
                        carryChildIds.set(parentId, new Set(childSet))
                        carryEnumerated.add(parentId)
                    }
                })
            }
            sessionCache.value = {
                rootIds: nextIds,
                childIds: carryChildIds,
                enumeratedParents: carryEnumerated
            }
            bumpRevision()
            error.value = ''
            firstLoading.value = false
            refreshing.value = false
            // 就绪后若有待检关键词 → 自动补拉子任务（未就绪输入自动重放的一部分）
            if (debouncedKeyword.value.trim() !== '') void ensureChildrenOnce()
        } finally {
            reloadQueued = false
        }
    }

    // @watch S7b 开关变化 → 重新按新口径拉取顶层（普通/删除/放弃四象限并集）
    watch(includeExcluded, () => {
        refreshing.value = !!sessionCache.value
        void reloadRoots()
    })

    // @watch P2 包含已归档开关 → 重新拉取顶层（纳入/移除归档任务）
    watch(includeArchived, () => {
        refreshing.value = !!sessionCache.value
        void reloadRoots()
    })

    // @method 重试（错误出口）
    const retry = () => {
        error.value = ''
        refreshing.value = !!sessionCache.value
        void reloadRoots()
    }

    // @events 订阅刷新（与日历同构）
    const onRefreshData = () => {
        refreshing.value = !!sessionCache.value
        void reloadRoots()
    }
    const onAddNewTaskId = (id: TaskViewObject['id']) => {
        const cache = sessionCache.value
        if (!cache) return
        const vo = tasksStore.getTask(id)
        if (!vo) return
        if (vo.parentTaskId) {
            if (cache.rootIds.has(vo.parentTaskId)) {
                const childSet = cache.childIds.get(vo.parentTaskId)
                if (childSet) childSet.add(id)
            }
        } else {
            cache.rootIds.add(id)
        }
        bumpRevision()
    }

    // @lifecycle
    onMounted(() => {
        appSubscriber.subscribe('RefreshData', onRefreshData)
        appSubscriber.subscribe('AddNewTaskId', onAddNewTaskId)
        void reloadRoots()
    })
    onUnmounted(() => {
        appSubscriber.unsubscribe('RefreshData', onRefreshData)
        appSubscriber.unsubscribe('AddNewTaskId', onAddNewTaskId)
        if (debounceTimer) clearTimeout(debounceTimer)
        if (enumResumeTimer) clearTimeout(enumResumeTimer)
    })

    return {
        keyword,
        writeKeyword,
        clearKeyword,
        // —— 结构化筛选（SEA-03） ——
        filterProjectIds,
        filterTagIds,
        filterPriorities,
        filterStates,
        includeExcluded,
        includeArchived,
        filtersActive,
        toggleProjectFilter,
        toggleTagFilter,
        togglePriorityFilter,
        toggleStateFilter,
        clearFilters,
        queryState,
        applyQuery,
        ready,
        firstLoading,
        refreshing,
        error,
        retry,
        capped,
        enumerating,
        enumFailures,
        enumRatePaused,
        rows,
        resultCount,
        rootCount
    }
}

export default useSearchEngine