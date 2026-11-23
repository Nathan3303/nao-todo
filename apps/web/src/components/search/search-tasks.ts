import { prioritySNMap, type TaskViewObject } from '@nao-todo/domain-task'
import { getLocale } from '@nao-todo/shared/locales'
import {
    DEFAULT_SEARCH_SORT,
    EMPTY_DUE_RANGE,
    dateKeyOfIso,
    isDueRangeActive,
    type SearchDueRange,
    type SearchSort
} from './search-sort'

/**
 * 搜索纯函数层（SEA-01）
 * @description 关键词过滤 + 排序（五种字段 × 升降序）+ 截止日区间筛选 + 高亮纯文本分段。
 *              零框架、可单测；高亮以「分段文本数组」返回（模板逐段渲染文本，禁 v-html 注入）。
 *              T770：一次性全量排序改为「轻量谓词计数 + 只对展示窗口做完整排序/高亮」，
 *              总数仍为全量命中数（见 `searchTasksPage`）。
 */

/** 高亮分段：一段文本是否命中关键词 */
export type SearchHitSegment = { text: string; hit: boolean }

/** 单条搜索结果（行渲染所需信息在纯层算好，视图零业务分支） */
export type SearchRow = {
    task: TaskViewObject
    /** 名称完整高亮分段（未命中态无此行） */
    nameSegments: SearchHitSegment[]
    /**
     * 描述行分段（恒显语义 SEA-D2-1：有描述即非 null；命中时为首命中窗口高亮，
     * 未命中时为整段纯文本 —— 不以「是否命中」当显隐开关）
     */
    descriptionSegments: SearchHitSegment[] | null
    /** 命中来源：仅“名称未命中、备注命中”为 true（S7a，行内显示「备注命中」） */
    descriptionOnlyHit: boolean
}

/** 搜索选项 */
export type SearchTasksOptions = {
    /** 是否纳入已归档（默认 false，P2 / ADR §15.2） */
    includeArchived?: boolean
    /** 排序（省略 = 相关性默认） */
    sort?: SearchSort
    /** 截止日区间（省略 = 不限；`''` 侧不限） */
    dueRange?: SearchDueRange
    /** 区间生效时是否保留「无截止日」任务（默认 false = 排除，需求口径 3） */
    includeNoDue?: boolean
    /** 返回行数上限（省略 = 不限，返回全量；总数恒为全量命中数） */
    limit?: number
}

/** 分页结果（总数 + 展示窗口 + 是否还有更多） */
export type SearchPageResult = {
    /** 全量命中数（不受 limit 影响） */
    total: number
    /** 展示窗口行（已排序，含高亮分段） */
    rows: SearchRow[]
    /** 命中数 > 展示窗口（还有更多可展开） */
    truncated: boolean
}

/** 备注预览窗口最大长度（命中周围截取） */
const DESC_PREVIEW_WINDOW = 120

/** 命中关键词是否更靠前（位置越小越“短命中”，排序键之一） */
const hitStartIndexOf = (text: string, kwLower: string): number =>
    text.toLowerCase().indexOf(kwLower)

/** 全部子串命中位置（不含重叠） */
const allHitIndexes = (text: string, kwLower: string): number[] => {
    const indexes: number[] = []
    const lower = text.toLowerCase()
    let from = 0
    for (;;) {
        const idx = lower.indexOf(kwLower, from)
        if (idx < 0) break
        indexes.push(idx)
        from = idx + kwLower.length
    }
    return indexes
}

/**
 * 按关键词切出高亮分段（大小写不敏感；只含命中的文本段与间隔段）
 */
export const highlightSegments = (text: string, keyword: string): SearchHitSegment[] => {
    const kwLower = keyword.trim().toLowerCase()
    if (!kwLower || !text) return text ? [{ text, hit: false }] : []
    const indexes = allHitIndexes(text, kwLower)
    if (indexes.length === 0) return [{ text, hit: false }]
    const segments: SearchHitSegment[] = []
    let cursor = 0
    indexes.forEach((idx) => {
        if (idx > cursor) segments.push({ text: text.slice(cursor, idx), hit: false })
        segments.push({ text: text.slice(idx, idx + kwLower.length), hit: true })
        cursor = idx + kwLower.length
    })
    if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false })
    return segments
}

/**
 * 备注命中预览：围绕首个命中截取窗口（命中前溢出则前置省略号；窗口截断则后置省略号）
 */
const buildDescriptionPreview = (description: string, kwLower: string): SearchHitSegment[] => {
    const firstHit = hitStartIndexOf(description, kwLower)
    if (firstHit < 0) return []
    const start = Math.max(0, firstHit - 36)
    const end = Math.min(description.length, start + DESC_PREVIEW_WINDOW)
    const segments: SearchHitSegment[] = []
    if (start > 0) segments.push({ text: '…', hit: false })
    segments.push(...highlightSegments(description.slice(start, end), kwLower))
    if (end < description.length) segments.push({ text: '…', hit: false })
    return segments
}

/**
 * 单条任务是否命中（名称或备注含关键词子串；大小写不敏感）
 */
export const isTaskHit = (task: TaskViewObject, kwLower: string): boolean =>
    task.name.toLowerCase().includes(kwLower) || task.description.toLowerCase().includes(kwLower)

/** 命中候选（排序键在过滤期一次算好，避免比较函数内重复计算/重复分配） */
type Candidate = {
    task: TaskViewObject
    nameHitStart: number
    descriptionHitStart: number
    /** 相关度键：[名称命中?0:1, 命中位置, 名称长度]（仅相关性排序时计算） */
    rank?: [number, number, number]
    /** 截止日键（`YYYY-MM-DD`；`''` = 无截止日；仅区间筛选/截止日排序时计算） */
    dueKey?: string
}

/** id 升序（跨引擎/入参顺序稳定的最终收敛键） */
const compareById = (a: Candidate, b: Candidate): number =>
    a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : 0

/** 文本比较（空值恒排最后、不随方向翻转；同值 0 交由 id 收敛） */
const compareEmptyLast = (a: string, b: string, dir: number): number => {
    if (a === b) return 0
    if (a === '') return 1
    if (b === '') return -1
    return (a < b ? -1 : 1) * dir
}

/** 优先级权重（单一来源 = domain `prioritySNMap`；非白名单脏值与 low 同档，同列表/日历口径） */
const priorityRank = (priority: string): number =>
    (prioritySNMap as Record<string, number>)[priority] ?? prioritySNMap.low

/** 名称比较器（按当前界面语言本地化；含数字自然序）——缓存避免逐条构造 */
let collatorLocale = ''
let collator: Intl.Collator | null = null
const nameCollator = (): Intl.Collator => {
    const current = String(getLocale().value ?? '')
    if (!collator || current !== collatorLocale) {
        collatorLocale = current
        collator = new Intl.Collator(current === '' ? undefined : current, { numeric: true })
    }
    return collator
}

/** 排序比较器（相关性无方向；其余按 order 翻转，空值恒最后） */
const comparatorOf = (sort: SearchSort): ((a: Candidate, b: Candidate) => number) => {
    const dir = sort.order === 'asc' ? 1 : -1
    switch (sort.field) {
        case 'updatedAt':
            return (a, b) =>
                compareEmptyLast(a.task.updatedAt, b.task.updatedAt, dir) || compareById(a, b)
        case 'dueAt':
            return (a, b) =>
                compareEmptyLast(a.dueKey ?? '', b.dueKey ?? '', dir) || compareById(a, b)
        case 'priority':
            return (a, b) =>
                (priorityRank(a.task.priority) - priorityRank(b.task.priority)) * dir ||
                compareById(a, b)
        case 'name':
            return (a, b) =>
                nameCollator().compare(a.task.name, b.task.name) * dir || compareById(a, b)
        case 'relevance':
        default: {
            // 名称命中 > 仅备注命中；组内「短命中」优先；平局 updatedAt 倒序，再 id 收敛
            return (a, b) => {
                const ak = a.rank!
                const bk = b.rank!
                for (let i = 0; i < ak.length; i++) {
                    if (ak[i] !== bk[i]) return ak[i]! - bk[i]!
                }
                return compareEmptyLast(a.task.updatedAt, b.task.updatedAt, -1) || compareById(a, b)
            }
        }
    }
}

/** 命中行构建（高亮分段；仅对展示窗口调用） */
const toRow = (candidate: Candidate, kwLower: string): SearchRow => {
    const { task, nameHitStart, descriptionHitStart } = candidate
    const nameHit = nameHitStart >= 0
    const descriptionHit = descriptionHitStart >= 0
    return {
        task,
        nameSegments: highlightSegments(task.name, kwLower),
        // 恒显：有描述即输出描述行（命中 → 高亮窗口；未命中 → 整段纯文本，由展示层 clamp/title）
        descriptionSegments: task.description
            ? descriptionHit
                ? buildDescriptionPreview(task.description, kwLower)
                : [{ text: task.description, hit: false }]
            : null,
        descriptionOnlyHit: !nameHit && descriptionHit
    }
}

/**
 * 搜索结果分页构建（过滤 + 计数 + 排序 + 展示窗口高亮）
 * @description T770 口径：
 *              ① 一遍轻量谓词（归档/删除/放弃/关键词/截止日区间）算出**全量命中数**；
 *              ② 只对命中候选排序（紧凑结构，不含高亮分段）；
 *              ③ 仅对展示窗口（前 `limit` 条）做高亮分段等「完整行」materialize。
 *              排序：相关性（默认，无方向）/ 更新时间 / 截止日 / 优先级 / 名称，后四者升/降；
 *              空值（无截止日 / 空更新时间）**恒排最后**，不随方向翻转；同值以 id 升序收敛。
 *              已归档默认排除，includeArchived 开启后纳入（P2）；已删除/已放弃恒排除。
 *              截止日 = `endAt`（本地自然日，闭区间）；`includeNoDue` 决定无截止日任务去留。
 */
export const searchTasksPage = (
    tasks: TaskViewObject[],
    keyword: string,
    options: SearchTasksOptions = {}
): SearchPageResult => {
    const kwLower = keyword.trim().toLowerCase()
    if (!kwLower) return { total: 0, rows: [], truncated: false }
    const includeArchived = options.includeArchived === true
    const includeNoDue = options.includeNoDue === true
    const sort = options.sort ?? DEFAULT_SEARCH_SORT
    const dueRange = options.dueRange ?? EMPTY_DUE_RANGE
    const filterDue = isDueRangeActive(dueRange)
    const needDueKey = filterDue || sort.field === 'dueAt'
    const needRank = sort.field === 'relevance'
    const candidates: Candidate[] = []
    for (const task of tasks) {
        if (task.isArchived && !includeArchived) continue
        if (task.isDeleted || task.isGivenUp) continue
        const nameHitStart = hitStartIndexOf(task.name, kwLower)
        const descriptionHitStart = hitStartIndexOf(task.description, kwLower)
        if (nameHitStart < 0 && descriptionHitStart < 0) continue
        const candidate: Candidate = { task, nameHitStart, descriptionHitStart }
        if (needDueKey) {
            const dueKey = dateKeyOfIso(task.endAt)
            candidate.dueKey = dueKey
            if (filterDue) {
                // 无截止日：默认排除；勾选「包含无截止日」后保留（不受区间约束）
                if (dueKey === '') {
                    if (!includeNoDue) continue
                } else if (
                    (dueRange.from !== '' && dueKey < dueRange.from) ||
                    (dueRange.to !== '' && dueKey > dueRange.to)
                ) {
                    continue
                }
            }
        }
        if (needRank) {
            candidate.rank =
                nameHitStart >= 0
                    ? [0, nameHitStart, task.name.length]
                    : [1, descriptionHitStart, task.name.length]
        }
        candidates.push(candidate)
    }
    const total = candidates.length
    candidates.sort(comparatorOf(sort))
    const limit = options.limit === undefined ? total : Math.max(0, Math.floor(options.limit))
    const visible = candidates.length > limit ? candidates.slice(0, limit) : candidates
    return {
        total,
        rows: visible.map((candidate) => toRow(candidate, kwLower)),
        truncated: visible.length < total
    }
}

/**
 * 搜索结果构建（全量行；等价于不限展示窗口的分页结果）
 * @description 保留给「需要完整命中行」的调用方与既有用例；视图侧用 `searchTasksPage`。
 */
export const searchTasks = (
    tasks: TaskViewObject[],
    keyword: string,
    options: SearchTasksOptions = {}
): SearchRow[] => searchTasksPage(tasks, keyword, options).rows

/** 日期键（YYYY-MM-DD）文本：同年仅 M月D日，跨年含年份（空输入返回 ''） */
export const dateKeyLabel = (dateKey: string | null | undefined, nowYear: number): string => {
    if (!dateKey) return ''
    const year = Number(dateKey.slice(0, 4))
    const month = Number(dateKey.slice(5, 7))
    const day = Number(dateKey.slice(8, 10))
    if (!year || !month || !day) return ''
    const md = `${month}月${day}日`
    return year === nowYear ? md : `${year}年${md}`
}

/**
 * 结构化筛选集合（SEA-03）
 * @description 四维全部为空数组 = 不过滤；维度数组为多选集合。
 *              收件箱以 projectId='' 哨兵表达（任务 projectId 为空串或 null 均命中）。
 */
export type SearchFilterSet = {
    projectIds: string[]
    tagIds: string[]
    priorities: string[]
    states: string[]
}

export const EMPTY_FILTER_SET: SearchFilterSet = {
    projectIds: [],
    tagIds: [],
    priorities: [],
    states: []
}

/**
 * 收集箱 projectId 归一（Fix A）
 * @description 真实数据以 `'inbox'` 标记收集箱，搜索内部/URL 以 `''` 为哨兵；
 *              比较前两端归一，避免 `'inbox'` 与 `''` 不等导致收件箱筛选恒不命中。
 *              保留 `null`（不强制转 `''`，由调用方按需兜底）。
 */
export const normalizeProjectId = (value: string | null | undefined): string | null =>
    value === 'inbox' ? '' : (value ?? null)

/**
 * 任务是否通过筛选（纯函数）
 * @description 维内 OR（多选任一命中即过）、维间 AND、与关键词由 searchTasks 另行 AND；
 *              空数组=不限（默认含已完成不变）。优先级/状态直接比 string 值。
 *              清单维两端归一 projectId（Fix A：`'inbox'` ↔ `''`）。
 */
export const matchTaskFilters = (task: TaskViewObject, filters: SearchFilterSet): boolean => {
    const { projectIds, tagIds, priorities, states } = filters
    if (projectIds.length > 0) {
        const taskProjectId = normalizeProjectId(task.projectId) ?? ''
        const filterProjectIds = projectIds.map((id) => normalizeProjectId(id) ?? '')
        if (!filterProjectIds.includes(taskProjectId)) return false
    }
    if (tagIds.length > 0 && !task.tags.some((id) => tagIds.includes(id))) return false
    if (priorities.length > 0 && !priorities.includes(task.priority)) return false
    if (states.length > 0 && !states.includes(task.state)) return false
    return true
}

/* —— 后端限流（10051 / 429 家族）识别与退避调度（纯函数，可单测） —— */

/** 限流信号特征（业务码或后端/网关文案） */
export const RATE_LIMIT_MARKERS = ['10051', '42900', '请求过于频繁', '请求太频繁', '限流'] as const

/** 是否限流类错误（列表/枚举/详情兜底共用） */
export const isRateLimitError = (message: string): boolean =>
    RATE_LIMIT_MARKERS.some((marker) => message.includes(marker))

/** 限流退避单次重试等待（指数 + 抖动；起点 1s、上限 ~15s） */
export const retryDelayFor = (
    failedAttempt: number,
    capMs = 15_000,
    rand: () => number = Math.random
): number => {
    const base = Math.min(capMs, 1000 * 2 ** failedAttempt)
    return Math.min(capMs, base * (1 + 0.2 * rand()))
}

/** 限流单请求最多尝试次数（含首次；之后仍失败则显式上抛给状态层，不静默） */
export const RATE_MAX_ATTEMPTS = 5
/** 枚举中连续限流父任务达到该阈值 → 暂停本轮并稍后自动恢复 */
export const RATE_PAUSE_THRESHOLD = 3