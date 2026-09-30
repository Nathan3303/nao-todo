/**
 * /sync/push 回执「被丢弃字段」白名单与消费助手（`T471` / `DEF-44` 客户端收口）
 * @description 服务端 additive `SyncResult.droppedFields`（nao-todo-server `T466`）如实上报
 *              「推送载荷含、但服务端 sync 条目 DTO 不承载」的 JSON 键（字典序）。客户端据此
 *              区分**真·契约漂移**与**已知不支持字段**：前者需可见诊断，后者每次推送必然出现、
 *              提示即纯噪声。
 *
 *              白名单来源 = 客户端 `SYNC_TABLES.entityToPush` 字段集 − 服务端 sync 条目 DTO
 *              承载键集（服务端由反射 json tag 得出，见 `nao-todo-server/interfaces/controllers/sync_dropped_fields.go`）。
 *              每条注明来源/所属缺陷。
 *
 *              ⚠️ **白名单不得多写**：服务端一旦补齐承载，其字段即不再出现在 `droppedFields` 中；
 *              防漂移用例（`__tests__/dropped-fields.test.ts`，以「契约镜像 fixture」校验
 *              `客户端发送集 − 服务端承载集 === 本白名单` 的**精确相等**）会失败 ⇒ 强制同步收敛，
 *              不留死白名单。
 */

/** 表 → 已知「客户端在发、服务端 sync DTO 不承载」的字段集（集中常量，单一事实源） */
export const KNOWN_UNSUPPORTED_PUSH_FIELDS: Readonly<Record<string, ReadonlySet<string>>> = {
    /** `icon` / `sortId` 无 DTO 承载（`DEF-47`） */
    projects: new Set(['icon', 'sortId']),
    /** `icon` / `sortId` 无 DTO 承载（`DEF-47` 同族：`CreateTagReq` 亦无） */
    tags: new Set(['icon', 'sortId']),
    /** `totalDuration` 无 DTO 承载（历史字段，服务端只存 `duration`） */
    pomodoros: new Set(['totalDuration']),
    /** `attachments` / `isTopUp` 仅 `UpdateTaskCommentReq` 承载；`deletedAt` 无承载（删除走独立 `deletions`） */
    taskComments: new Set(['attachments', 'isTopUp', 'deletedAt']),
    /** `deletedAt` 无承载（删除走独立 `deletions`） */
    taskCheckItems: new Set(['deletedAt']),
    /** `deletedAt` 无承载（删除走独立 `deletions`） */
    pomodoroRecords: new Set(['deletedAt'])
}

/** 某表某字段是否属「已知不支持」（表/字段未列出 ⇒ 非已知） */
export const isKnownUnsupportedPushField = (table: string, field: string): boolean =>
    KNOWN_UNSUPPORTED_PUSH_FIELDS[table]?.has(field) ?? false

/**
 * 从一条 push 回执的 `droppedFields` 挑出**非白名单**（真·漂移）字段，去重后字典序。
 * @description 缺省 / 非数组 / 空 / 非字符串项 ⇒ 一律忽略（旧服务端无该字段 ⇒ 逐字 no-op，
 *              **不需要**能力开关）。
 * @param droppedFields 回执里的原始值（unknown；逐项收敛）
 * @param table 该条所属 sync 表（用于白名单匹配）
 * @returns 非白名单字段（字典序）；无 ⇒ `[]`
 */
export const pickUnexpectedDroppedFields = (droppedFields: unknown, table: string): string[] => {
    if (!Array.isArray(droppedFields)) return []
    const out = new Set<string>()
    for (const field of droppedFields) {
        if (typeof field !== 'string' || field === '') continue
        if (!isKnownUnsupportedPushField(table, field)) out.add(field)
    }
    return [...out].sort()
}