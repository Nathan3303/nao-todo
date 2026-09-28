/**
 * 冲突 diff 展示层纯函数（T332）—— 分组 / 三态分类 / 技术字段 / 长值 判定
 *
 * @description 只做**展示**变换，不改合并语义、不改恢复动作、不改计数。
 *              可单测（无 Vue / 无 DOM 依赖）。
 * @see docs/adr/2026-09-24-stage2-both-ends-local-first.md §9.2（冲突 UX）
 */
import type {
    ConflictFieldDiff,
    ConflictListItem
} from '@nao-todo/infrastructure/src/persistence-sync/conflict-journal'

/** 字段差异三态：仅「当前」有值 ⇒ 新增；仅「我的（败方）」有值 ⇒ 删除；两侧都有但不同 ⇒ 修改 */
export type FieldDiffKind = 'added' | 'removed' | 'changed'

/** 三态符号（与语义色、文字标签**三重承载** ⇒ 不单靠颜色） */
export const DIFF_SYMBOL: Record<FieldDiffKind, string> = {
    added: '+',
    removed: '−',
    changed: '~'
}

/** 三态文字标签 i18n 键（与符号/颜色三重冗余 ⇒ 灰阶 / 色觉差异下仍可辨） */
export type FieldDiffLabelKey =
    | 'sync.conflict.fieldAdded'
    | 'sync.conflict.fieldRemoved'
    | 'sync.conflict.fieldChanged'

export const DIFF_LABEL_KEY: Record<FieldDiffKind, FieldDiffLabelKey> = {
    added: 'sync.conflict.fieldAdded',
    removed: 'sync.conflict.fieldRemoved',
    changed: 'sync.conflict.fieldChanged'
}

/**
 * 技术字段（默认隐藏）：时间戳 / 版本令牌 / 主键 / 排序等 —— 业务字段（name/state/...）之外。
 * 用户方向：`updatedAt` / `revision` 等技术字段默认隐藏、需要时可展开。
 */
const TECHNICAL_FIELDS: ReadonlySet<string> = new Set([
    'id',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'syncedServerUpdatedAt',
    'revision',
    'sortId'
])

/** 是否技术字段 */
export const isTechnicalField = (field: string): boolean => TECHNICAL_FIELDS.has(field)

/** 字段差异三态分类（`null`/`undefined` 视为「无值」） */
export const classifyFieldDiff = (diff: ConflictFieldDiff): FieldDiffKind => {
    const loserMissing = diff.loser === null || diff.loser === undefined
    const currentMissing = diff.current === null || diff.current === undefined
    if (loserMissing && !currentMissing) return 'added'
    if (!loserMissing && currentMissing) return 'removed'
    return 'changed'
}

/** 可见差异：默认过滤技术字段；`showTechnical` ⇒ 全量（保持原顺序） */
export const visibleDiffs = (
    diffs: ConflictFieldDiff[],
    showTechnical: boolean
): ConflictFieldDiff[] => (showTechnical ? diffs : diffs.filter((d) => !isTechnicalField(d.field)))

/** 同一实体（`table:entityId`）归一组 */
export interface ConflictGroup {
    key: string
    table: string
    entityId: string
    items: ConflictListItem[]
}

/** 按对象分组：同 `table:entityId` 的多条冲突归为一组（保持首次出现顺序） */
export const groupConflictItems = (items: ConflictListItem[]): ConflictGroup[] => {
    const groups = new Map<string, ConflictGroup>()
    for (const item of items) {
        const key = `${item.table}:${item.entityId}`
        const existing = groups.get(key)
        if (existing) {
            existing.items.push(item)
        } else {
            groups.set(key, { key, table: item.table, entityId: item.entityId, items: [item] })
        }
    }
    return [...groups.values()]
}

/**
 * 分组 / 条目标题：优先实体可读名（`name` / `title`）⇒ `entityId` ⇒ `fallback`。
 * **保证返回非空字符串**（不得空白 / `undefined` / `null`），取不到时优雅降级。
 * @description `fallback` 由调用方给出（组件传「本地化 kind 标签 ⇒ 未知对象」）⇒ 不产生空白标题。
 */
export const conflictTitleOf = (item: ConflictListItem, fallback: string): string => {
    const loser = item.loser ?? {}
    const title = loser.name ?? loser.title
    if (typeof title === 'string' && title.trim()) return title.trim()
    if (item.entityId.trim()) return item.entityId
    return fallback
}

/** 值 → 展示文本（`null`/`undefined` ⇒ `—`；对象 ⇒ JSON） */
export const formatFieldValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—'
    switch (typeof value) {
        case 'string':
            return value
        case 'number':
        case 'boolean':
        case 'bigint':
            return String(value)
        case 'symbol':
            return value.toString()
        case 'function':
            return value.name || 'function'
        default:
            try {
                return JSON.stringify(value) ?? '—'
            } catch {
                return '—'
            }
    }
}

/** 长值判定（超过 `max` 字符 ⇒ 默认截断、可展开） */
export const isLongValue = (text: string, max = 80): boolean => text.length > max