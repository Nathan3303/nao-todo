/**
 * 冲突 diff 值 → 面向用户的展示文本（DEF-133）
 *
 * @description 面板**不得**直接渲染原始值：标签 ID / 清单 ID / 裸枚举 / ISO 时间 / 空白都不可读。
 *              本模块是纯函数（无 Vue / 无 DOM），供 `conflict-list.vue` 统一调用，便于单测。
 *              - 空值（`null` / `undefined` / `''` / `[]`）⇒ 「未设置」（不空白）；
 *              - `tags` ⇒ 标签名称；`projectId` ⇒ 清单名；
 *              - `state` / `priority` / `remindRepeat` 等枚举 ⇒ 复用既有 i18n 标签；
 *              - 日期时间 ⇒ 复用既有相对日期工具；布尔 ⇒ 是/否；数组 ⇒ 可读列表；
 *              - 未知值 ⇒ 原样返回（不崩、不吞）。
 * @see docs/adr/2026-09-24-stage2-both-ends-local-first.md §9.2（冲突 UX）
 */
import { t, type LocaleKey } from '@nao-todo/shared/locales'
import date2RelativeDate from '@nao-todo/shared/utils/relative-date-parser'

/** 外部解析器（组件经 DI 注入 store 查询；缺省 ⇒ 走安全回退） */
export interface ConflictValueResolvers {
    /** 标签 ID ⇒ 标签名称 */
    tagName?: (id: string) => string | undefined | null
    /** 清单 ID ⇒ 清单名称 */
    projectName?: (id: string) => string | undefined | null
}

/** 任务状态枚举 ⇒ 既有 i18n 键（兼容历史 `doing` / camelCase 写法） */
const STATE_LABEL_KEYS: Record<string, LocaleKey> = {
    todo: 'task.state.todo',
    'in-progress': 'task.state.inProgress',
    inProgress: 'task.state.inProgress',
    doing: 'task.state.inProgress',
    done: 'task.state.done'
}

/** 优先级枚举 ⇒ 既有 i18n 键 */
const PRIORITY_LABEL_KEYS: Record<string, LocaleKey> = {
    none: 'task.priority.none',
    low: 'task.priority.low',
    medium: 'task.priority.medium',
    high: 'task.priority.high',
    urgent: 'task.priority.urgent'
}

/** 提醒重复枚举 ⇒ 冲突命名空间 i18n 键（既有文案不在此模块，避免跨域耦合） */
const REMIND_REPEAT_LABEL_KEYS: Record<string, LocaleKey> = {
    none: 'sync.conflict.value.remindRepeat.none',
    daily: 'sync.conflict.value.remindRepeat.daily',
    weekly: 'sync.conflict.value.remindRepeat.weekly',
    monthly: 'sync.conflict.value.remindRepeat.monthly'
}

/** 星期数字 ⇒ i18n 键（数据为 1–7，0 兼容周日写法） */
const WEEKDAY_LABEL_KEYS: Record<number, LocaleKey> = {
    0: 'sync.conflict.value.weekday.sun',
    1: 'sync.conflict.value.weekday.mon',
    2: 'sync.conflict.value.weekday.tue',
    3: 'sync.conflict.value.weekday.wed',
    4: 'sync.conflict.value.weekday.thu',
    5: 'sync.conflict.value.weekday.fri',
    6: 'sync.conflict.value.weekday.sat',
    7: 'sync.conflict.value.weekday.sun'
}

/** 空值判定（用于「未设置」渲染 + 灰化样式；与格式化保持同一口径） */
export const isUnsetValue = (value: unknown): boolean => {
    if (value === null || value === undefined || value === '') return true
    return Array.isArray(value) && value.length === 0
}

/** 日期字段（`*At`；`remindTime` 是 `HH:mm`，不是日期） */
const isDateField = (field: string): boolean => field.endsWith('At')

const formatDate = (value: string): string => {
    const [text, error] = date2RelativeDate(value)
    return error || !text ? value : text
}

const formatEnum = (field: string, value: string): string => {
    const key =
        field === 'state'
            ? STATE_LABEL_KEYS[value]
            : field === 'priority'
              ? PRIORITY_LABEL_KEYS[value]
              : field === 'remindRepeat'
                ? REMIND_REPEAT_LABEL_KEYS[value]
                : undefined
    return key ? t(key) : value
}

const formatProject = (value: string, resolvers: ConflictValueResolvers): string => {
    if (value === 'inbox') return t('sync.conflict.value.inbox')
    const name = resolvers.projectName?.(value)?.trim()
    return name || t('sync.conflict.value.unknownProject')
}

const formatTags = (values: unknown[], resolvers: ConflictValueResolvers): string => {
    const names = values
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .map((id) => resolvers.tagName?.(id)?.trim() || t('sync.conflict.value.unknownTag'))
    return names.join(t('sync.conflict.value.listSeparator'))
}

const formatWeekdays = (values: unknown[]): string => {
    const names = values
        .filter((value): value is number => typeof value === 'number')
        .map((day) => {
            const key = WEEKDAY_LABEL_KEYS[day]
            return key ? t(key) : String(day)
        })
    return names.join(t('sync.conflict.value.listSeparator'))
}

const formatScalar = (value: unknown): string => {
    if (value === null || value === undefined || value === '') {
        return t('sync.conflict.value.unset')
    }
    if (typeof value === 'boolean')
        return value ? t('sync.conflict.value.yes') : t('sync.conflict.value.no')
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'bigint') return String(value)
    try {
        return JSON.stringify(value) ?? t('sync.conflict.value.unset')
    } catch {
        return t('sync.conflict.value.unset')
    }
}

/**
 * 字段值 → 展示文本（所有字段值的唯一入口；组件**不得**在模板里按 ID/枚举分支）
 * @param field 字段名（决定枚举 / 引用类字段的映射）
 * @param value 原始值（快照或当前实体字段）
 * @param resolvers 标签 / 清单名称解析器（缺省 ⇒ 回退「未知…」，不崩）
 */
export const formatConflictValue = (
    field: string,
    value: unknown,
    resolvers: ConflictValueResolvers = {}
): string => {
    // 清单字段的 `''` 语义是「未选择清单」，先于通用空值处理
    if (field === 'projectId') {
        if (value === null || value === undefined) return t('sync.conflict.value.unset')
        if (value === '') return t('sync.conflict.value.noProject')
        if (typeof value === 'string') return formatProject(value, resolvers)
    }
    if (isUnsetValue(value)) return t('sync.conflict.value.unset')
    if (Array.isArray(value)) {
        if (field === 'tags') return formatTags(value, resolvers)
        if (field === 'remindWeekdays') return formatWeekdays(value)
        return value.map(formatScalar).join(t('sync.conflict.value.listSeparator'))
    }
    if (typeof value === 'boolean')
        return value ? t('sync.conflict.value.yes') : t('sync.conflict.value.no')
    if (typeof value === 'string') {
        if (isDateField(field)) return formatDate(value)
        return formatEnum(field, value)
    }
    if (typeof value === 'number' || typeof value === 'bigint') return String(value)
    try {
        return JSON.stringify(value) ?? t('sync.conflict.value.unset')
    } catch {
        return t('sync.conflict.value.unset')
    }
}