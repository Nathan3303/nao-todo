/**
 * 提醒候选直读（T527 · PRD §六 NFR / 报告 §6）
 * @description 供本机提醒引擎使用的候选查询：**不复用列表查询** `list()`
 *              （它默认只取顶层任务且不排 done，会漏子任务、误弹已完成；且全表解密 O(N) 次 AES）。
 *
 *              本函数直读明文结构列做粗筛：
 *              - 只取「有 remindAt 且未删除」的记录（含子任务，`parentTaskId` 不过滤）；
 *              - **只对已到期行解密** `name` / `description`（未到期行仅用于精确调度，不需要明文）。
 *              活跃态（归档 / 放弃 / done）不在此过滤，由 `collectDueReminders` 统一裁定（单一口径）。
 */
import type { ReminderTask } from '@nao-todo/shared/reminder'
import { cryptoService } from '../crypto/crypto-service'
import { localDatabase, type NaoTodoLocalDatabase } from '../db/local-database'
import { localSession } from '../session/local-session'
import { isNotDeleted } from '../utils'

/** 到期容差（ms）：与轮询基准间隔同量级的是否到期判定，覆盖扫描/调度耗时 */
const DUE_TOLERANCE_MS = 1_000

/**
 * 查询本机提醒候选
 * @param nowMs 引擎口径的当前时间（校准后毫秒）；与判定同源，避免「解密窗口」与「到期判定」错位
 * @param db 本地库（测试可注入）
 */
export const listReminderCandidates = async (
    nowMs: number = Date.now(),
    db: NaoTodoLocalDatabase = localDatabase
): Promise<ReadonlyArray<ReminderTask>> => {
    const userId = localSession.requireCurrentUserId()
    const records = await db.tasks.where('userId').equals(userId).toArray()
    const candidates: ReminderTask[] = []
    for (const record of records) {
        if (!record.remindAt) continue
        if (!isNotDeleted(record.deletedAt)) continue
        const remindTimestamp = new Date(record.remindAt).getTime()
        const decryptable =
            Number.isFinite(remindTimestamp) && remindTimestamp <= nowMs + DUE_TOLERANCE_MS
        candidates.push({
            id: record.id,
            name: decryptable ? await cryptoService.decrypt(record.name) : '',
            description: decryptable ? await cryptoService.decrypt(record.description) : undefined,
            remindAt: record.remindAt,
            remindRepeat: record.remindRepeat,
            remindTime: record.remindTime,
            remindWeekdays: record.remindWeekdays,
            endAt: record.endAt,
            state: record.state,
            deletedAt: record.deletedAt,
            archivedAt: record.archivedAt,
            givenUpAt: record.givenUpAt,
            parentTaskId: record.parentTaskId
        })
    }
    return candidates
}