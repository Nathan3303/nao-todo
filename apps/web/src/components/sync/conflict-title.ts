/**
 * 冲突对象标题解析（DEF-134）—— 左栏「这一行是什么东西冲突了」
 *
 * @description 左栏一行 = 一个冲突对象（`table:entityId`），标题必须能**指认对象**：
 *              1. 优先**当前行**（与 `compareConflict` 的 `current` 同源：本地当前行明文）的
 *                 `name` / `title`；评论取 `content` 摘要、检查项取 `name`；
 *              2. 评论 / 检查项 ⇒「父任务名 · 摘要」（父任务按 `taskId` 查一次并缓存）；
 *              3. 仍取不到 ⇒ 表名 + 短 ID（≤8 位）；⛔ **不得只显示裸记录 ID**。
 *              ⛔ 不用败方快照回退：快照只存**差异字段 + 身份字段**（A1/A3），常无 `name`
 *                 —— 那正是「非任务类型冲突只显示记录 ID」的根因（DEF-134）。
 *              纯函数（无 Vue / 无 DOM），数据读取由 `useConflictUx` 注入（DI 唯一入口）。
 */
import type { ConflictListItem } from '@nao-todo/infrastructure/src/persistence-sync/conflict-journal'

/** 标题来源（当前行可读名 + 父任务名）；取不到为 `null` */
export interface ConflictTitleSource {
    /** 当前行可读名（`name` / `title` / 评论摘要 / 检查项名） */
    name: string | null
    /** 父任务名（仅 `taskComments` / `taskCheckItems` 有意义） */
    parentTaskName: string | null
}

/** 键 = `table:entityId`（与左栏分组同口径） */
export type ConflictTitleMap = Record<string, ConflictTitleSource>

/** 读当前行明文的注入点（缺失 ⇒ `null`）；由 hook 经冲突实体注册表实现 */
export interface ConflictTitleDeps {
    getCurrent: (table: string, entityId: string) => Promise<Record<string, unknown> | null>
}

/** 子表（标题需拼接父任务名） */
const CHILD_TABLES: ReadonlySet<string> = new Set(['taskComments', 'taskCheckItems'])

/** 标题分隔符（父任务名 · 摘要） */
const TITLE_SEPARATOR = ' · '

/** 短 ID 长度上限（长 ID 撑爆一行且不可读） */
export const SHORT_ID_LENGTH = 8

/** 短 ID：取前 8 位（不裸展示完整记录 ID） */
export const shortEntityId = (entityId: string): string => entityId.trim().slice(0, SHORT_ID_LENGTH)

/** 文本归一（折叠空白、去首尾）；非字符串 / 空白 ⇒ `null` */
const normalizeText = (value: unknown): string | null => {
    if (typeof value !== 'string') return null
    const text = value.replace(/\s+/g, ' ').trim()
    return text ? text : null
}

/**
 * 当前行实体 ⇒ 可读名
 * @description 评论正文是 `content`（无 `name` 字段）；检查项 / 任务 / 清单 / 标签为 `name`；
 *              兜底 `title` / `content`；都没有 ⇒ `null`（由调用方降级，不臆造）。
 */
export const recordTitleName = (
    table: string,
    record: Record<string, unknown> | null | undefined
): string | null => {
    if (!record) return null
    if (table === 'taskComments') {
        return (
            normalizeText(record.content) ??
            normalizeText(record.name) ??
            normalizeText(record.note)
        )
    }
    return (
        normalizeText(record.name) ?? normalizeText(record.title) ?? normalizeText(record.content)
    )
}

/**
 * 冲突对象 ⇒ 左栏标题（**保证非空**，且**不以裸 ID 作标题**）
 * @param target 冲突对象（`table` + `entityId`）
 * @param source 当前行标题来源（`collectConflictTitles` 结果 / `comparison.current` 派生）
 * @param tableLabel 表名 → 本地化标签（i18n 由组件注入，本模块不引文案）
 */
export const conflictObjectTitle = (
    target: { table: string; entityId: string },
    source: ConflictTitleSource | null | undefined,
    tableLabel: (table: string) => string
): string => {
    const own = normalizeText(source?.name)
    const parent = normalizeText(source?.parentTaskName)
    if (CHILD_TABLES.has(target.table) && parent) {
        return own ? `${parent}${TITLE_SEPARATOR}${own}` : parent
    }
    if (own) return own
    if (parent) return parent
    const label = tableLabel(target.table)
    const short = shortEntityId(target.entityId)
    return short ? `${label}${TITLE_SEPARATOR}${short}` : label
}

/**
 * 批量解析左栏标题（**按对象去重、父任务名按 `taskId` 缓存**，不逐条查）
 * @description 任一读取失败 ⇒ 该对象降级为「表名 + 短 ID」（不抛错、不阻塞列表）
 */
export const collectConflictTitles = async (
    items: ConflictListItem[],
    deps: ConflictTitleDeps
): Promise<ConflictTitleMap> => {
    const tasks = new Map<string, Promise<string | null>>()

    const getCurrent = async (
        table: string,
        entityId: string
    ): Promise<Record<string, unknown> | null> => {
        try {
            return await deps.getCurrent(table, entityId)
        } catch {
            return null
        }
    }

    /** 父任务名：同一 `taskId` 只查一次（组内多条冲突共用） */
    const parentTaskNameOf = (taskId: string): Promise<string | null> => {
        const cached = tasks.get(taskId)
        if (cached) return cached
        const pending = getCurrent('tasks', taskId).then((record) =>
            recordTitleName('tasks', record)
        )
        tasks.set(taskId, pending)
        return pending
    }

    const unique = new Map<string, ConflictListItem>()
    for (const item of items) {
        const key = `${item.table}:${item.entityId}`
        if (!unique.has(key)) unique.set(key, item)
    }

    const entries = await Promise.all(
        [...unique.entries()].map(async ([key, item]): Promise<[string, ConflictTitleSource]> => {
            const record = await getCurrent(item.table, item.entityId)
            const name = recordTitleName(item.table, record)
            let parentTaskName: string | null = null
            if (CHILD_TABLES.has(item.table)) {
                const taskId = normalizeText(record?.taskId)
                if (taskId) parentTaskName = await parentTaskNameOf(taskId)
            }
            return [key, { name, parentTaskName }]
        })
    )

    return Object.fromEntries(entries)
}