/**
 * 编辑期覆盖记账（`DEF-146` / AC1）
 *
 * @description 两条链路共用本模块的**唯一**判等口径（`valuesEqual`）与忽略字段（`SYNC_COMPARE_IGNORED_FIELDS`）：
 *              ① 拉取侧 A1（`sync-service.recordPullLocalWins`）—— 从远端快照里挑出差异字段；
 *              ② 保存侧（本地仓储）—— 字段级**三值判定**：`R` 云端当前值 × `L` 本次载荷 × `O` 编辑基准。
 *
 *              保存侧判据（PM 冻结，⛔ 不得改口径）：`F = keys(载荷) ∩ keys(编辑基准)`，
 *              逐字段 `(R_f ≠ O_f) 且 (L_f ≠ R_f)` 才记账；只把命中的 `R_f` 存进快照
 *              （`appendConflict` 负责最小化、≤512 截断、上限 200、journal 锁 RMW）。
 *
 * @see docs/prds/2026-11-07-edit-vs-remote-overwrite.md（R-1…R-8 / AC1–AC9）
 * @see docs/reports/T668-def146-verdict.md §2/§3
 * @see docs/adr/2026-11-06-edit-vs-remote-overwrite.md
 */
import { logStructured, STRUCTURED_LOG_EVENTS } from '../observability/structured-log'
import { appendConflict, valuesEqual } from './conflict-journal'
import { syncStatus } from './sync-status'
import { SYNC_COMPARE_IGNORED_FIELDS } from './sync-normalize'

/**
 * 挑出两侧「业务内容不同」的字段（键集 = 两侧并集 − 忽略字段）
 * @description A1 的产物口径：远端 / 本地两侧任一存在且内容不等即为差异（`valuesEqual` 归一空哨兵）。
 */
export const pickChangedFields = (
    left: Record<string, unknown>,
    right: Record<string, unknown>,
    ignoredFields: ReadonlySet<string> = SYNC_COMPARE_IGNORED_FIELDS
): string[] => {
    const fields: string[] = []
    for (const field of new Set([...Object.keys(left), ...Object.keys(right)])) {
        if (ignoredFields.has(field)) continue
        if (valuesEqual(left[field], right[field])) continue
        fields.push(field)
    }
    return fields
}

/**
 * 保存侧三值判定：返回「编辑期间被远端改过 **且** 我确实要覆盖」的字段
 * @param cloud 库中云端当前值（写前读取，`R`）
 * @param payload 本次保存载荷（`L`；`undefined` = 本次不触碰）
 * @param origin 编辑基准（`O`；缺省 ⇒ 恒空，零行为变化 R-6）
 */
export const pickOverwrittenFields = (
    cloud: Record<string, unknown>,
    payload: Record<string, unknown>,
    origin?: Record<string, unknown> | null,
    ignoredFields: ReadonlySet<string> = SYNC_COMPARE_IGNORED_FIELDS
): string[] => {
    if (!origin) return []
    const fields: string[] = []
    // F = keys(载荷) ∩ keys(编辑基准)：两侧都要有，且载荷确实携带该字段
    for (const field of Object.keys(payload)) {
        if (ignoredFields.has(field)) continue
        if (!Object.prototype.hasOwnProperty.call(origin, field)) continue
        if (payload[field] === undefined) continue
        // ① 我编辑期间这个字段被改过（R ≠ O）
        if (valuesEqual(cloud[field], origin[field])) continue
        // ② 我确实要覆盖它（L ≠ R）
        if (valuesEqual(payload[field], cloud[field])) continue
        fields.push(field)
    }
    return fields
}

/** 保存侧记账入参 */
export interface EditOverwriteInput {
    userId: string
    table: string
    entityId: string
    /** 库中云端当前值（`R`；写前读取） */
    cloud: Record<string, unknown>
    /** `pickOverwrittenFields` 的结果（非空才调用） */
    fields: string[]
    /** 本次本地写入产生的 `updatedAt`（= 胜方版本） */
    winnerUpdatedAt: string
}

/**
 * 保存侧记账：复用 `appendConflict`（`kind = 'pull-local-wins'`，零新 kind / 零新文案）
 * @description 记账在保存事务**之后**执行（journal 走 `navigator.locks` + 另一次 `meta` 写，
 *              不能进 Dexie 事务）⇒ **失败只 log，不抛出**（保存不阻断、不回滚，R-5 / AC3）。
 *              日志只带实体 id / table / 原因，**不落明文业务值**。
 */
export const recordEditOverwrite = async (input: EditOverwriteInput): Promise<void> => {
    const { userId, table, entityId, cloud, fields, winnerUpdatedAt } = input
    if (!userId || fields.length === 0) return
    try {
        const loser: Record<string, unknown> = { id: entityId }
        for (const field of fields) {
            loser[field] = cloud[field] === undefined ? null : cloud[field]
        }
        const count = await appendConflict(userId, {
            kind: 'pull-local-wins',
            table,
            entityId,
            loser,
            winnerUpdatedAt
        })
        syncStatus.setConflictCount(count)
    } catch (err) {
        // 级别 = error（PM 追加要求）：含义是「一次真实覆盖没有任何记录」= 本批能力失效，
        //   warn 在默认告警面极易漏（DEF-143 教训）
        logStructured('error', STRUCTURED_LOG_EVENTS.SYNC_JOURNAL_RECORD_FAILED, {
            table,
            entityId,
            // reason 只放错误类型 / 摘要，不落业务值
            reason: String(err)
        })
    }
}