import type { TaskViewObject } from '@nao-todo/domain-task'

/**
 * 搜索纯函数层（SEA-01）
 * @description 关键词过滤 + 相关度排序 + 高亮纯文本分段。零框架、可单测；
 *              高亮以「分段文本数组」返回（模板逐段渲染文本，禁 v-html 注入）。
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

/**
 * 搜索结果构建（过滤 + 排序 + 高亮分段）
 * @description 排序：名称命中 > 仅备注命中；组内「短命中」优先（命中位置更靠前，
 *              同位置取名称更短）；平局 updatedAt 倒序（再做 id 稳定收敛）。
 *              已删除/已归档/已放弃 一律不参与（纯层防御，管线查询已同口径排除）。
 */
export const searchTasks = (tasks: TaskViewObject[], keyword: string): SearchRow[] => {
    const kwLower = keyword.trim().toLowerCase()
    if (!kwLower) return []
    type RankKey = [number, number, number]
    type RankedRow = { rank: RankKey; row: SearchRow }
    const ranked: RankedRow[] = []
    for (const task of tasks) {
        if (task.isDeleted || task.isArchived || task.isGivenUp) continue
        const nameHitStart = hitStartIndexOf(task.name, kwLower)
        const nameHit = nameHitStart >= 0
        const descriptionHitStart = hitStartIndexOf(task.description, kwLower)
        const descriptionHit = descriptionHitStart >= 0
        if (!nameHit && !descriptionHit) continue
        const row: SearchRow = {
            task,
            nameSegments: highlightSegments(task.name, kwLower),
            // 恒显：有描述即输出描述行（命中 → 高亮窗口；未命中 → 整段纯文本，由展示层 clamp/title）
            descriptionSegments: task.description
                ? descriptionHit
                    ? buildDescriptionPreview(task.description, kwLower)
                    : [{ text: task.description, hit: false }]
                : null
        }
        // 排序键（避免行内重复计算字符串比较）
        const rank: RankKey = nameHit
            ? [0, nameHitStart, task.name.length]
            : [1, descriptionHitStart, task.name.length]
        ranked.push({ rank, row })
    }
    ranked.sort((a, b) => {
        for (let i = 0; i < a.rank.length; i++) {
            const ak = a.rank[i]!
            const bk = b.rank[i]!
            if (ak !== bk) return ak - bk
        }
        if (a.row.task.updatedAt !== b.row.task.updatedAt)
            return a.row.task.updatedAt < b.row.task.updatedAt ? 1 : -1
        return a.row.task.id < b.row.task.id ? -1 : a.row.task.id > b.row.task.id ? 1 : 0
    })
    return ranked.map(({ row }) => row)
}

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
 * 任务是否通过筛选（纯函数）
 * @description 维内 OR（多选任一命中即过）、维间 AND、与关键词由 searchTasks 另行 AND；
 *              空数组=不限（默认含已完成不变）。优先级/状态直接比 string 值。
 */
export const matchTaskFilters = (task: TaskViewObject, filters: SearchFilterSet): boolean => {
    const { projectIds, tagIds, priorities, states } = filters
    if (projectIds.length > 0 && !projectIds.includes(task.projectId || '')) return false
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