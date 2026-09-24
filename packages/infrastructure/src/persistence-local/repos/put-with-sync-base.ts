import type { Table } from 'dexie'

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