import { TASK_PRIORITIES, TASK_STATES } from '@nao-todo/domain-task'

/**
 * 搜索 URL 深链编解码（SEA-04 / S2）
 * @description URL query 为搜索状态唯一真源：纯函数、零框架、可单测。
 *              - 数组维度以 `,` 连接；空值不写入（URL 保持干净）；
 *              - 收件箱哨兵 projectId='' 编码为 `inbox` token（D1）；
 *              - 优先级/状态按领域白名单过滤非法值（AC9 忽略非法值）。
 */

/** 搜索状态（URL query 的真源投影） */
export type SearchQueryState = {
    keyword: string
    projectIds: string[]
    tagIds: string[]
    priorities: string[]
    states: string[]
}

/** URL query 原始值域（vue-router LocationQuery 的宽松对账口径） */
export type RawSearchQuery = Record<string, string | string[] | null | undefined>

/** 空状态 */
export const EMPTY_SEARCH_QUERY: SearchQueryState = {
    keyword: '',
    projectIds: [],
    tagIds: [],
    priorities: [],
    states: []
}

/** 收件箱哨兵 token（D1） */
const INBOX_TOKEN = 'inbox'

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

/** URL query → 搜索状态（非法值忽略、数组去重） */
export const parseSearchQuery = (raw: RawSearchQuery): SearchQueryState => ({
    keyword: toSingle(raw.q),
    projectIds: dedupe(toTokens(raw.project).map((token) => (token === INBOX_TOKEN ? '' : token))),
    tagIds: dedupe(toTokens(raw.tag)),
    priorities: dedupe(toTokens(raw.priority).filter((value) => isAllowed(TASK_PRIORITIES, value))),
    states: dedupe(toTokens(raw.state).filter((value) => isAllowed(TASK_STATES, value)))
})

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
        sameList(a.states, b.states)
    )
}