import type { Table } from 'dexie'
import type { NaoTodoLocalDatabase, SyncAction } from '../db/local-database'
import { syncTracker } from '../../persistence-sync/sync-tracker'

/**
 * 写回行时保留 per-row 服务端版本基线（`syncedServerUpdatedAt`）。
 *
 * OCC（阶段二 2B）以业务行上的 `syncedServerUpdatedAt` 作为 push 的 `baseUpdatedAt`
 * 来源。本地写经 domain 实体往返（`recordToEntity` → `entityToRecord`）会丢失该
 * 同步元数据字段（实体不含），故 `put` 前从库中旧行回填。
 *
 * - 旧行缺失 / 无该字段 ⇒ 原样写回（新建、旧库存量数据）；
 * - 直连表写入，字段**非索引** ⇒ 不 bump Dexie version / 不触 C-44；
 * - 读旧行再写存在「读-改-写」，同 origin 单写者假设（C-57 / navigator.locks）下安全。
 *
 * @see docs/adr/2026-09-24-stage2-both-ends-local-first.md §9.1.6-(i)（R-20 灾难路径守护）
 */
export const putWithSyncBase = async <T extends { id: string }>(
    table: Table<T, string>,
    record: T
): Promise<unknown> => {
    const existing = (await table.get(record.id)) as { syncedServerUpdatedAt?: string } | undefined
    const base = existing?.syncedServerUpdatedAt
    if (base !== undefined) {
        ;(record as { syncedServerUpdatedAt?: string }).syncedServerUpdatedAt = base
    }
    return table.put(record)
}

/**
 * 原子写入：业务行 + `syncQueue` 入队在**同一 Dexie `rw` 事务**内（T326 / RC-5 / AC-T325-7）。
 *
 * 背景：`putWithSyncBase` 与 `markDirty` 是两次独立 await、无事务（ADR T325 §7 ③）⇒ pull 可在
 * 「业务行已落库、队列尚未入队」的窗口内读到空队列并无条件覆盖 ⇒ **无 journal 的静默丢写**。
 * 本助手把两者收进一个事务：外部读者（含 pull）只能看到「都未写」或「都写了」，不存在中间态。
 *
 * - 事务内**只允许 Dexie 操作**（不得 await 外部长 Promise；Dexie 会过早提交，见 Dexie `PrematureCommitError`）
 *   ⇒ `record` 必须由调用方在事务外构造完毕（加解密在事务外）；
 * - 事务内 `markDirty` 经传入的 `queue` 表写入，与业务表同属 `db` ⇒ 同一事务；
 * - 失败（如入队抛错）⇒ 事务整体回滚，**不留下「未入队的本地写」**。
 *
 * @see docs/adr/2026-09-28-sync-conflict-timestamp-basis.md §7（RC-5）
 */
export const putWithSyncBaseAndEnqueue = async <T extends { id: string }>(
    db: NaoTodoLocalDatabase,
    table: Table<T, string>,
    tableName: string,
    record: T,
    action: SyncAction,
    updatedAt: string
): Promise<void> => {
    await db.transaction('rw', table, db.syncQueue, async () => {
        await putWithSyncBase(table, record)
        await syncTracker.markDirty(tableName, record.id, action, updatedAt, db.syncQueue)
    })
}