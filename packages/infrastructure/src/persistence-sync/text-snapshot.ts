/**
 * 文本快照截断 / 字节计量**唯一实现**（冲突记账快照 + 变更审计共用）
 *
 * @description 抽取原因（`T703` / 评审 §8.2）：`>512` 文本截断与 `truncated` / `truncatedFields`
 *              双标记同时被**冲突记账快照**（`conflict-journal.buildConflictSnapshot`）与
 *              **变更审计**（`audit-log`）使用 ⇒ ⛔ 不得出现第二份截断逻辑或第二个 `512` 字面量
 *              （口径一旦漂移，两处会出现「一条被截断、一条没有」）。
 *
 *              本模块**纯函数、零 IO、零框架依赖**（可被 domain 之外的任意层安全引用）。
 */

/** 单值文本截断上限（字符数；`R-H` / `R-5` 冻结口径） */
export const SNAPSHOT_TEXT_LIMIT = 512

/** 单值截断（非字符串 / 未超限原样返回） */
export const truncateTextValue = (value: unknown): unknown =>
    typeof value === 'string' && value.length > SNAPSHOT_TEXT_LIMIT
        ? value.slice(0, SNAPSHOT_TEXT_LIMIT)
        : value

/**
 * 逐字段截断一个记录/对象（保持原键序）
 * @param source 待截断的对象
 * @param skip 需要跳过的字段（如记录层元字段）
 * @returns `values` = 截断后的对象；`truncatedFields` = 被截断的字段名（按原序）
 */
export const truncateSnapshotValues = (
    source: Record<string, unknown>,
    skip?: ReadonlySet<string>
): { values: Record<string, unknown>; truncatedFields: string[] } => {
    const values: Record<string, unknown> = {}
    const truncatedFields: string[] = []
    for (const [field, raw] of Object.entries(source)) {
        if (skip?.has(field)) continue
        const truncated = truncateTextValue(raw)
        if (truncated !== raw) truncatedFields.push(field)
        values[field] = truncated
    }
    return { values, truncatedFields }
}

/**
 * UTF-8 字节数（`JSON.stringify` 后计量）
 * @description 「单条 ≤1 KB 预算」按**字节**而非字符口径（中文 1 字 = 3 字节）；
 *              计量与截断同属本模块 ⇒ 预算判定与截断实现不会各算一套。
 */
export const utf8ByteLength = (value: unknown): number =>
    new TextEncoder().encode(JSON.stringify(value)).length