import type { GetTasksOptions } from '@nao-todo/shared'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { computed, inject, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { Ref } from 'vue'
import { useTaskUseCase } from '@/hooks'
import { useTasksStore } from '@nao-todo/presentation/task'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
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

/** 顶层列表查询（与日历同口径：顶层/未删除/未归档/未放弃/含已完成；id asc 稳定翻页） */
const buildRootQuery = (page: number): GetTasksOptions => ({
    isDeleted: false,
    isArchived: false,
    isGivenUp: false,
    sort: { field: 'id', order: 'asc' },
    limit: PAGE_LIMIT,
    page
})

/** 子任务列表查询（单父；同排除口径） */
const buildChildQuery = (parentTaskId: string, page: number): GetTasksOptions => ({
    parentTaskId,
    isDeleted: false,
    isArchived: false,
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

    // @states 视图状态
    const keyword = ref('')
    const debouncedKeyword = ref('')
    const firstLoading = ref<boolean>(!sessionCache.value) // 首拉门（无缓存时整页加载）
    const refreshing = ref<boolean>(false) // 后台刷新（有缓存不闪屏）
    const error = ref('') // 拉取错误（重试出口）
    const capped = ref(false) // 顶层已达 5000 上限
    const enumerating = ref(false) // 子任务补拉中（顶部轻提示）
    const enumFailures = ref(0) // 本次补拉失败的父任务数（>0 时轻提示）
    const enumRatePaused = ref(false) // 枚举连续限流暂停（提示「限流，稍后自动重试」）

    // @states 结构化筛选（SEA-03：会话内状态；空数组=不过滤；收件箱=projectId ''）
    const filterProjectIds = ref<string[]>([]) // 清单（含收件箱哨兵 ''）
    const filterTagIds = ref<string[]>([]) // 标签
    const filterPriorities = ref<string[]>([]) // 优先级 high/medium/low
    const filterStates = ref<string[]>([]) // 状态 todo/in-progress/done

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
        return searchTasks(base, debouncedKeyword.value)
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

    /** 分页拉取顶层到集合；穷尽或触顶探测后设置 capped */
    const sweepRootsInto = async (target: Set<string>): Promise<void> => {
        capped.value = false
        let exhausted = false
        for (let page = 1; page <= MAX_ROOT_PAGES; page++) {
            const res = await callList(buildRootQuery(page))
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
                    buildRootQuery(MAX_ROOT_PAGES + 1)
                )
                if (probeErr === null && probeRes.taskIds.length > 0) capped.value = true
            } catch {
                /* 忽略探测错误：5000 条快照已可用 */
            }
        }
    }

    /** 单父任务子任务补拉（失败抛出，由并发池计数；成功标记已枚举） */
    const loadChildrenOf = async (parentId: string): Promise<void> => {
        const cache = sessionCache.value
        if (!cache || cache.enumeratedParents.has(parentId)) return
        const childSet = new Set<string>()
        for (let page = 1; page <= MAX_CHILD_PAGES; page++) {
            const res = await callList(buildChildQuery(parentId, page))
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
                await sweepRootsInto(nextIds)
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
        filtersActive,
        toggleProjectFilter,
        toggleTagFilter,
        togglePriorityFilter,
        toggleStateFilter,
        clearFilters,
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