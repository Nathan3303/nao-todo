/**
 * 同步边界归一 / 判等（T644 · DEF-132 + F-09）
 *
 * @description ① **空值口径**：服务端 JSON 与客户端载荷对「空」的表示不一致 —— 服务端用 `''`（空串）、
 *                 `null`、`'none'`（提醒重复 = 无）表示空，客户端实体用 `null` / `[]` / `'none'`。
 *                 ⇒ **判等 / 归一必须走本模块的唯一口径**（⛔ 勿在调用点另写第二套，否则口径会漂）。
 *              ② **收集箱桶映射**：本地字面 `'inbox'` ↔ 服务端隐式桶 `userId`（pull / 「保留服务端」
 *                 写回同一条链，故映射放在此处、由两侧共用）。
 *
 *              ⚠️ 本模块只做「空值等价 / 业务字段判等 / 桶映射」，**不做**形状修复：
 *              把服务端行转成实体仍必须走 pull 同一条链（`resToEntity` → `entityToRecord`）。
 *
 * @see docs/reports/T640-sync-a-batch-arch-review.md（Q2 伪 stale 消噪 / 口径）
 * @see docs/reports/defect-pool.md（DEF-132）
 */

/**
 * 判等忽略字段（身份 / 时间 / 同步基线 —— 不属于「业务内容差异」）
 * @description `updatedAt` 必然前进（服务端写入时间）、`baseUpdatedAt` 是 OCC 契约字段，
 *              二者参与比较只会使判等恒不成立。
 */
export const SYNC_COMPARE_IGNORED_FIELDS: ReadonlySet<string> = new Set([
    'id',
    'userId',
    'updatedAt',
    'syncedServerUpdatedAt',
    'revision',
    'baseUpdatedAt'
])

/**
 * 是否为「等价空」哨兵值
 * @description 归一口径（PM 冻结）：`''` / `null` / `undefined` / `'none'` / `[]` 视为等价空。
 *              `0` / `false` / 非空数组**不算空**（计数器与布尔是真实业务值）。
 */
export const isEmptySyncSentinel = (value: unknown): boolean => {
    if (value === null || value === undefined || value === '') return true
    if (typeof value === 'string') return value.toLowerCase() === 'none'
    if (Array.isArray(value)) return value.length === 0
    return false
}

/** 业务值判等：两侧皆「等价空」⇒ 相等；其余按 JSON 深比较 */
export const sameSyncValue = (left: unknown, right: unknown): boolean => {
    if (isEmptySyncSentinel(left) && isEmptySyncSentinel(right)) return true
    if (left === right) return true
    if (left === null || right === null) return false
    if (typeof left !== 'object' || typeof right !== 'object') return false
    try {
        return JSON.stringify(left) === JSON.stringify(right)
    } catch {
        return false
    }
}

/**
 * 伪 `stale` 判等（F-09 / D7）：**本次推送载荷携带的业务字段**是否在服务端行上已生效
 *
 * @param payload 本次实际发出的推送记录（`SYNC_TABLES.entityToPush` 产出 + `id` / `baseUpdatedAt`）
 * @param serverRecord 回执 `serverCurrent`（服务端当前行）
 * @description **只遍历载荷字段**：载荷未携带的字段（`checkItemCount` / `commentCount` /
 *              `subtaskCount` / `sortId` 等服务端 owned 项、以及未发送的字段）无法据此判断
 *              「我的写入是否生效」⇒ 不参与判等（否则真服务端永远判不出 pseudo）。
 * @returns `true` ⇒ 服务端当前内容与我的载荷一致（伪 stale，应按 `applied` 处理）
 */
export const syncPayloadMatchesServer = (
    payload: Record<string, unknown>,
    serverRecord: Record<string, unknown>,
    ignoredFields: ReadonlySet<string> = SYNC_COMPARE_IGNORED_FIELDS
): boolean => {
    for (const field of Object.keys(payload)) {
        if (ignoredFields.has(field)) continue
        if (!sameSyncValue(payload[field], serverRecord[field])) return false
    }
    return true
}

/**
 * 收集箱本地哨兵（单一口径：数据面一律字面 `'inbox'`）
 * @description 服务端隐式桶以 `userId` 承载（create/update 对 `''` 归一为 `userId`）。
 *              R-5 闭环（T188）在**同步边界**做对称映射：写侧 `'inbox'` → `''`、读侧 `userId` → `'inbox'`；
 *              两端唯一落点分别为 `buildTaskPush` / `putPulledRecord`，此处供 pull 与
 *              「保留服务端」写回（`resolveConflictKeepServer`）**共用同一读侧映射**。
 * @see docs/adr/2026-09-24-project-archive.md §15.1 / Q4
 */
export const INBOX_PROJECT_ID = 'inbox'

/** 写侧（push 载荷构造）：本地收集箱 `'inbox'` ⇒ 空串（服务端 create/update 归一为 `userId`） */
export const toPushProjectId = (projectId: unknown): unknown =>
    projectId === INBOX_PROJECT_ID ? '' : projectId

/**
 * 读侧（落库）：服务端隐式桶 `userId` ⇒ 本地字面 `'inbox'`
 * @description 空值守门（T193）：仅当两侧都是「非空标量」且相等时才归一 —— `''` 是「无清单」的合法
 *              本地表示，不得归一；也防未来类型漂移（如 `projectId` 缺失时
 *              `String(undefined) === 'undefined'`）导致静默误归一。
 */
export const toLocalProjectId = (projectId: unknown, userId: string): unknown =>
    projectId != null && projectId !== '' && String(projectId as string) === String(userId)
        ? INBOX_PROJECT_ID
        : projectId