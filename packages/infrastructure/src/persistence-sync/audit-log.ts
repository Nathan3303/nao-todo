/**
 * 变更审计日志读写 API（A 档 / Issue #346 · **M1 = 只做数据层**）
 *
 * @description 旁路追加型审计（ADR `2026-11-10-audit-log-bypass-log`）：只追加、不参与裁决、
 *              不参与同步、**写入失败不阻断业务写**。本模块是 `auditLogs` 表的**唯一写入口**
 *              （`recordAudit`；源级守卫见 `t697-audit-source-guard.test.ts`）。
 *
 *              M1 = 表结构（`Dexie` `version(5)` 空升级，见 `local-database.ts`）+ 本模块读写 API；
 *              **不接任何业务写点**（M2/M3）、不含 1000 条 / 90 天淘汰（M4）、无面板（M5）。
 *
 *              口径（M1 只承接**存储侧**，判定一律在调用方）：
 *              - `fields` = 调用方**已算好的**字段级 diff ⇒ 本模块⛔ 不判定、不排序、不补默认值
 *                （判据「落库前后本地行是否真的变了」、忽略集与收集箱桶归一都在调用方，R-2 / R-9）；
 *              - 值形状 = **同步边界的实体明文** ⇒ 本模块⛔ 不 import 加解密与记录层转换器：
 *                一旦落记录层前缀形状，界面会出现该前缀、且与实体层判等恒不等（`T676` 教训）；
 *              - `at` = 写入时刻的**本机（校时后）**时间 ⇒ ⛔ 不取行的 `updatedAt`（远端时钟会漂，`AC18`）；
 *              - 有界（M1 只做单条规模）：单值文本 >512 截断、单条序列化 ≤1 KB（`AC6` 前半段）。
 *
 * @see docs/prds/2026-11-10-audit-log.md（R-1…R-9 / AC1–AC11）
 * @see docs/reports/T696-audit-log-arch-review.md（§2 模型 / §3 写入口 / §5 值形状 / §8 有界）
 * @see docs/adr/2026-11-10-audit-log-bypass-log.md（决策 1–5 / 回滚三级）
 */
import {
    localDatabase,
    type AuditAction,
    type AuditFieldDiff,
    type AuditLogRecord,
    type AuditSource
} from '../persistence-local/db/local-database'
import { localSession } from '../persistence-local/session/local-session'
import { logStructured, STRUCTURED_LOG_EVENTS } from '../observability/structured-log'
import { CONFLICT_SNAPSHOT_TEXT_LIMIT } from './conflict-journal'
import { nowCalibratedIso } from './sync-config'

/** 审计表名（ADR 决策 1：同库新表） */
export const AUDIT_TABLE = 'auditLogs'

/** 首版只 `tasks`（`R-8`；其余实体按同一 helper 逐个接入，`projects` 须先解 `DEF-155`） */
export const AUDIT_ENTITY_TASKS = 'tasks'

/**
 * 单值文本截断上限
 * @description 复用 journal 的 512 口径（⛔ 另造字面量；同 `buildConflictSnapshot` 语义：
 *              `truncated: true` + `truncatedFields: [字段名]`）
 */
export const AUDIT_VALUE_TEXT_LIMIT = CONFLICT_SNAPSHOT_TEXT_LIMIT

/**
 * 单条序列化字节预算（UTF-8，`C5` / `AC6`）
 * @description 「总量 ≤2 MB」成立的前提：1000 条 × 多字段 × 2 值 × 512 字符的理论上界 ≈3 MB。
 */
export const AUDIT_ENTRY_BYTE_BUDGET = 1024

/** 面板默认每页条数（M5「更早」由调用方传更大窗口） */
export const AUDIT_PAGE_SIZE = 5

/** 支撑「按实体取最近 N 条」的复合索引（键相同 ⇒ 迭代序退化为 `seq` 序，`reverse()` 即最新在前） */
const AUDIT_ENTITY_INDEX = '[userId+entity+entityId]'

/** 条目级预算降级后的取值占位符（arch §8.2：先降值、再降字段） */
const AUDIT_DEGRADED_VALUE = '[已截断]'

/** 一条审计条目（面板契约：**不含**内部元字段，`T697` Q2 冻结形状） */
export interface AuditLogItem {
    /** 插入序（= 主键）；keyset 分页游标，⛔ 不用 offset */
    seq: number
    at: string
    source: AuditSource
    action: AuditAction
    fields: AuditFieldDiff[]
}

/** `loadAudit` 的返回（`unavailable` 专表「老库无历史」，⛔ 不用空数组冒充） */
export interface AuditLogPage {
    /** `seq` 降序 = 最新在前 */
    items: AuditLogItem[]
    /** 本页之外还有更早的记录 */
    hasMore: boolean
    /** 表不可用（老库 / 旧版本连接）⇒ UI 走「暂无变更记录」空态，⛔ 不显示错误 */
    unavailable: boolean
}

/** `recordAudit` 入参 */
export interface AuditAppendInput {
    entityId: string
    action: AuditAction
    source: AuditSource
    /** 已算好的字段级 diff（数组顺序即落库顺序；非 `update` 类传空数组） */
    fields?: readonly AuditFieldDiff[]
}

/**
 * 审计表是否在当前打开的 schema 里
 * @description 老库 / 旧版本连接 ⇒ `false`：读写都按「不可用」处理（读返回 `unavailable`、
 *              写 no-op），⛔ 不抛错（ADR §2.5）。
 */
const hasAuditTable = (): boolean =>
    localDatabase.tables.some((table) => table.name === AUDIT_TABLE)

/** UTF-8 字节数（「1 KB 预算」按字节而非字符口径） */
const byteLength = (value: unknown): number =>
    new TextEncoder().encode(JSON.stringify(value)).length

/** 单值截断（非字符串原样返回） */
const truncateText = (value: unknown): unknown =>
    typeof value === 'string' && value.length > AUDIT_VALUE_TEXT_LIMIT
        ? value.slice(0, AUDIT_VALUE_TEXT_LIMIT)
        : value

/** 值级截断 + 登记被截断字段名 */
const truncateValues = (
    fields: readonly AuditFieldDiff[]
): { fields: AuditFieldDiff[]; truncatedFields: string[] } => {
    const truncatedFields: string[] = []
    const next = fields.map((diff) => {
        const from = truncateText(diff.from)
        const to = truncateText(diff.to)
        if (from !== diff.from || to !== diff.to) truncatedFields.push(diff.field)
        return { field: diff.field, from, to }
    })
    return { fields: next, truncatedFields }
}

/** 组装待写入记录（`truncated` 双标记仅在有截断时出现，省字节） */
const buildRecord = (
    base: Omit<AuditLogRecord, 'fields' | 'truncated' | 'truncatedFields'>,
    fields: AuditFieldDiff[],
    truncatedFields: string[]
): AuditLogRecord =>
    truncatedFields.length > 0
        ? { ...base, fields, truncated: true, truncatedFields }
        : { ...base, fields }

/**
 * 条目级字节预算：序列化 >1 KB ⇒ 按传入**字段顺序**逐个把 `from`/`to` 降级为占位符；
 * 全部降级后仍超预算（字段名本身过多）⇒ `fields` 置空。两种情况都置 `truncated`。
 * @description 字段名与值都不删整条（「一次写 = 1 条」不可破）；只牺牲取值精度。
 */
const fitEntryBudget = (
    base: Omit<AuditLogRecord, 'fields' | 'truncated' | 'truncatedFields'>,
    fields: AuditFieldDiff[],
    truncatedFields: string[]
): AuditLogRecord => {
    let record = buildRecord(base, fields, truncatedFields)
    for (let index = 0; index < fields.length; index += 1) {
        if (byteLength(record) <= AUDIT_ENTRY_BYTE_BUDGET) return record
        const degraded = record.fields.map((diff, position) =>
            position === index
                ? { field: diff.field, from: AUDIT_DEGRADED_VALUE, to: AUDIT_DEGRADED_VALUE }
                : diff
        )
        record = buildRecord(base, degraded, [
            ...new Set([...truncatedFields, record.fields[index]!.field])
        ])
    }
    return byteLength(record) <= AUDIT_ENTRY_BYTE_BUDGET
        ? record
        : buildRecord(base, [], truncatedFields)
}

/**
 * 追加 1 条审计（每实体 1 次业务写 ⇒ 1 条）
 * @description **旁路**：不参与业务事务（Dexie 事务内 await 外部 Promise 会
 *              `PrematureCommitError`），业务提交成功后再调用；本函数**永不 reject**
 *              —— 失败只留 `audit.record.failed`（error 级，**不含业务值**）。
 * @param input 已算好的动作 / 来源 / 字段级 diff
 * @returns 新条目的 `seq`；表不可用或写入失败 ⇒ `null`
 */
export const recordAudit = async (input: AuditAppendInput): Promise<number | null> => {
    const { entityId, action, source, fields = [] } = input
    try {
        if (!hasAuditTable()) return null
        const userId = localSession.requireCurrentUserId()
        const truncated = truncateValues(fields)
        const record = fitEntryBudget(
            {
                userId,
                entity: AUDIT_ENTITY_TASKS,
                entityId,
                action,
                // 本机写时刻（校时后）；⛔ 不取行时间戳（`AC18`：远端时钟会漂）
                at: nowCalibratedIso(),
                source
            },
            truncated.fields,
            truncated.truncatedFields
        )
        return Number(await localDatabase.auditLogs.add(record))
    } catch (err) {
        logStructured('error', STRUCTURED_LOG_EVENTS.AUDIT_RECORD_FAILED, {
            entity: AUDIT_ENTITY_TASKS,
            entityId,
            // reason 只放错误摘要，不落业务值
            reason: String(err)
        })
        return null
    }
}

/** 派单口径的别名（唯一写入口的名字以 `recordAudit` 为准，见本文件源级守卫） */
export const appendAudit = recordAudit

/**
 * 读某任务的变更历史（`seq` 降序 = 最新在前）
 * @param entityId 任务 ID
 * @param beforeSeq keyset 游标：只取 `seq < beforeSeq` 的条目（⛔ 不用 offset，插入序会漂）
 * @param limit 本页条数（缺省 `AUDIT_PAGE_SIZE`）
 */
export const loadAudit = async (
    entityId: string,
    beforeSeq?: number,
    limit: number = AUDIT_PAGE_SIZE
): Promise<AuditLogPage> => {
    const unavailablePage = (unavailable: boolean): AuditLogPage => ({
        items: [],
        hasMore: false,
        unavailable
    })
    try {
        if (!hasAuditTable()) return unavailablePage(true)
        const userId = localSession.requireCurrentUserId()
        // 复合索引键相同 ⇒ 迭代序即主键（`seq`）序；`reverse()` ⇒ 最新在前
        const keys = await localDatabase.auditLogs
            .where(AUDIT_ENTITY_INDEX)
            .equals([userId, AUDIT_ENTITY_TASKS, entityId])
            .reverse()
            .primaryKeys()
        const start = beforeSeq === undefined ? 0 : keys.findIndex((key) => Number(key) < beforeSeq)
        if (start < 0) return unavailablePage(false)
        const window = keys.slice(start, start + limit + 1)
        const rows = await localDatabase.auditLogs.bulkGet(
            window.slice(0, limit).map((key) => Number(key))
        )
        const items: AuditLogItem[] = []
        for (const [position, row] of rows.entries()) {
            if (!row) continue
            items.push({
                seq: Number(window[position]),
                at: row.at,
                source: row.source,
                action: row.action,
                fields: row.fields ?? []
            })
        }
        return { items, hasMore: window.length > limit, unavailable: false }
    } catch {
        // 读失败 = 不可用（老数据 / 旧版本连接）⇒ 空态，⛔ 不显示错误（PRD NFR「兼容」）
        return unavailablePage(true)
    }
}

/**
 * 某用户的审计条数
 * @param userId 缺省取当前会话用户（C-55 硬失败口径：无会话即抛）
 */
export const countAudit = async (
    userId: string = localSession.requireCurrentUserId()
): Promise<number> => {
    if (!hasAuditTable()) return 0
    return localDatabase.auditLogs.where('userId').equals(userId).count()
}

/**
 * 清空某用户的审计（整表清除 = 产品回滚二级；清库链路接线留 M4）
 * @param userId 缺省取当前会话用户
 * @returns 实际删除条数
 */
export const clearAudit = async (
    userId: string = localSession.requireCurrentUserId()
): Promise<number> => {
    if (!hasAuditTable()) return 0
    return localDatabase.auditLogs.where('userId').equals(userId).delete()
}