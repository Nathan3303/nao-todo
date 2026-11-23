import { TASK_PRIORITIES, TASK_STATES } from '@nao-todo/domain-task'
import {
    DEFAULT_SEARCH_SORT,
    isSearchSortField,
    isSearchSortOrder,
    isCustomSort,
    normalizeDateKey,
    searchSortEquals,
    type SearchSort
} from './search-sort'

/**
 * 搜索 URL 深链编解码（SEA-04 / S2）
 * @description URL query 为搜索状态唯一真源：纯函数、零框架、可单测。
 *              - 数组维度以 `,` 连接；空值不写入（URL 保持干净）；
 *              - 收件箱哨兵 projectId='' 编码为 `inbox` token（D1）；
 *              - 优先级/状态按领域白名单过滤非法值（AC9 忽略非法值）；
 *              - `archived=1` 表示「包含已归档」开关（P2）；
 *              - `sort=field:order` / `dueFrom` / `dueTo` / `noDue=1`（T770，**全部可选**：
 *                缺省 = 默认排序 / 无区间 / 不含无截止日；旧 URL 与旧保存搜索不受影响）。
 */

/** 搜索状态（URL query 的真源投影） */
export type SearchQueryState = {
    keyword: string
    projectIds: string[]
    tagIds: string[]
    priorities: string[]
    states: string[]
    includeArchived: boolean
    /** 排序（省略 = 相关性默认；仅非默认排序时存在） */
    sort?: SearchSort
    /** 截止日起 `YYYY-MM-DD`（省略/空 = 不限） */
    dueFrom?: string
    /** 截止日止 `YYYY-MM-DD`（省略/空 = 不限；闭区间） */
    dueTo?: string
    /** 区间生效时是否保留「无截止日」任务（省略 = false） */
    includeNoDue?: boolean
}

/** URL query 原始值域（vue-router LocationQuery 的宽松对账口径） */
export type RawSearchQuery = Record<string, string | string[] | null | undefined>

/** 空状态 */
export const EMPTY_SEARCH_QUERY: SearchQueryState = {
    keyword: '',
    projectIds: [],
    tagIds: [],
    priorities: [],
    states: [],
    includeArchived: false
}

/** 收件箱哨兵 token（D1） */
const INBOX_TOKEN = 'inbox'

/** 包含已归档开关的 URL 编码值（P2） */
const ARCHIVED_ON = '1'

/** 包含无截止日开关的 URL 编码值（T770） */
const NO_DUE_ON = '1'

/** 排序 token 分隔符（`field:order`，与仓储 sort 契约同形状） */
const SORT_SEPARATOR = ':'

/** 数组维度分隔符 */
const LIST_SEPARATOR = ','

/** 原始值 → token 列表（数组值先 join；逐段 trim；丢弃空段） */
const toTokens = (raw: string | string[] | null | undefined): string[] => {
    const joined = Array.isArray(raw) ? raw.join(LIST_SEPARATOR) : (raw ?? '')
    return joined
        .split(LIST_SEPARATOR)
        .map((token) => token.trim())
        .filter((token) => token !== '')
}

/** 去重并保序 */
const dedupe = (tokens: string[]): string[] => [...new Set(tokens)]

/** 单值字符串归一（数组取首值） */
const toSingle = (raw: string | string[] | null | undefined): string => {
    if (Array.isArray(raw)) return raw[0] ?? ''
    return raw ?? ''
}

/** 是否属于枚举白名单 */
const isAllowed = (allowed: readonly string[], value: string): boolean => allowed.includes(value)

/**
 * 排序 token → 排序状态
 * @description 字段/方向任一非法 → undefined（忽略非法值）；等于默认排序也归为 undefined，
 *              使「默认排序」在 URL/存储中不留痕迹（旧链接与旧保存搜索零影响）。
 */
export const parseSortToken = (raw: string | null | undefined): SearchSort | undefined => {
    const token = (raw ?? '').trim()
    if (token === '') return undefined
    const sep = token.indexOf(SORT_SEPARATOR)
    if (sep <= 0) return undefined
    const field = token.slice(0, sep)
    const order = token.slice(sep + 1)
    if (!isSearchSortField(field) || !isSearchSortOrder(order)) return undefined
    const sort: SearchSort = { field, order }
    return isCustomSort(sort) ? sort : undefined
}

/** 排序状态 → token（默认排序返回 `''`，调用方据此省略键） */
export const serializeSort = (sort?: SearchSort | null): string =>
    isCustomSort(sort) && sort ? `${sort.field}${SORT_SEPARATOR}${sort.order}` : ''

/** URL query → 搜索状态（非法值忽略、数组去重） */
export const parseSearchQuery = (raw: RawSearchQuery): SearchQueryState => {
    const sort = parseSortToken(toSingle(raw.sort))
    const dueFrom = normalizeDateKey(toSingle(raw.dueFrom))
    const dueTo = normalizeDateKey(toSingle(raw.dueTo))
    return {
        keyword: toSingle(raw.q),
        projectIds: dedupe(
            toTokens(raw.project).map((token) => (token === INBOX_TOKEN ? '' : token))
        ),
        tagIds: dedupe(toTokens(raw.tag)),
        priorities: dedupe(
            toTokens(raw.priority).filter((value) => isAllowed(TASK_PRIORITIES, value))
        ),
        states: dedupe(toTokens(raw.state).filter((value) => isAllowed(TASK_STATES, value))),
        includeArchived: toSingle(raw.archived) === ARCHIVED_ON,
        ...(sort ? { sort } : {}),
        ...(dueFrom !== '' ? { dueFrom } : {}),
        ...(dueTo !== '' ? { dueTo } : {}),
        ...(toSingle(raw.noDue) === NO_DUE_ON ? { includeNoDue: true } : {})
    }
}

/** 搜索状态 → URL query（空值省略；收件箱哨兵回写 token） */
export const serializeSearchQuery = (state: SearchQueryState): Record<string, string> => {
    const query: Record<string, string> = {}
    const keyword = state.keyword.trim()
    if (keyword !== '') query.q = keyword
    if (state.projectIds.length > 0) {
        query.project = state.projectIds
            .map((id) => (id === '' ? INBOX_TOKEN : id))
            .join(LIST_SEPARATOR)
    }
    if (state.tagIds.length > 0) query.tag = state.tagIds.join(LIST_SEPARATOR)
    if (state.priorities.length > 0) query.priority = state.priorities.join(LIST_SEPARATOR)
    if (state.states.length > 0) query.state = state.states.join(LIST_SEPARATOR)
    if (state.includeArchived) query.archived = ARCHIVED_ON
    const sortToken = serializeSort(state.sort)
    if (sortToken !== '') query.sort = sortToken
    const dueFrom = normalizeDateKey(state.dueFrom)
    if (dueFrom !== '') query.dueFrom = dueFrom
    const dueTo = normalizeDateKey(state.dueTo)
    if (dueTo !== '') query.dueTo = dueTo
    if (state.includeNoDue === true) query.noDue = NO_DUE_ON
    return query
}

/** 状态等价（与 URL 对账，避免 replace 回环） */
export const searchQueryEquals = (a: SearchQueryState, b: SearchQueryState): boolean => {
    if (a.keyword !== b.keyword) return false
    const sameList = (x: string[], y: string[]) =>
        x.length === y.length && x.every((value, index) => value === y[index])
    return (
        sameList(a.projectIds, b.projectIds) &&
        sameList(a.tagIds, b.tagIds) &&
        sameList(a.priorities, b.priorities) &&
        sameList(a.states, b.states) &&
        a.includeArchived === b.includeArchived &&
        // T770 新维度：缺省按默认值比较（旧状态 undefined ↔ 新状态默认值等价）
        searchSortEquals(a.sort, b.sort ?? DEFAULT_SEARCH_SORT) &&
        normalizeDateKey(a.dueFrom) === normalizeDateKey(b.dueFrom) &&
        normalizeDateKey(a.dueTo) === normalizeDateKey(b.dueTo) &&
        (a.includeNoDue === true) === (b.includeNoDue === true)
    )
}

/**
 * 是否需要把本地状态再导出到 URL（SEA-04-DEF-02 / B 方案）
 * @description 本地状态为真源：当本地状态与当前 query 不等价时需 replace 回写；
 *              等价（含非法值清洗后等价）则短路，避免冗余导航与回环。
 */
export const needsSearchQueryReExport = (local: SearchQueryState, raw: RawSearchQuery): boolean =>
    !searchQueryEquals(local, parseSearchQuery(raw))