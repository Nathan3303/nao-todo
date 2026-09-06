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
    /** 备注命中片段预览（未命中备注时为 null；命中时按首命中窗口截取） */
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
            descriptionSegments: descriptionHit
                ? buildDescriptionPreview(task.description, kwLower)
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