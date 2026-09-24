/**
 * 冲突实体注册表（T165 / W3 · PM 裁定「单一事实源」）
 *
 * @description `resolveConflictRetryLocal` / `compareConflict` 需要「表名 → 本地表 / 转换器」映射，
 *              而 `SYNC_TABLES` 定义在 `sync-service.ts`（T166b 起**已导出**；但本文件直接 import 会构成
 *              `sync-service → conflict-journal → 本文件` 的循环，故**仍不 import**，只读复用各域既有
 *              转换器与本地表，不复制第二套真源）。
 *
 *              **一致性守护**：`__tests__/conflict-entity-registry.test.ts` 直接 import `SYNC_TABLES`
 *              做**集合级**断言（本表 key 集 ≡ `SYNC_TABLES` 表集，防漂移），**无文本耦合**。
 *
 * @see docs/adr/2026-09-24-stage2-both-ends-local-first.md §9.1.6 / §9.2
 */
import type { Table } from 'dexie'
import { localDatabase } from '../persistence-local/db/local-database'
import { putWithSyncBase } from '../persistence-local/repos/put-with-sync-base'
import {
    projectEntityToRecord,
    projectRecordToEntity
} from '../persistence-local/converters/project'
import { tagEntityToRecord, tagRecordToEntity } from '../persistence-local/converters/tag'
import {
    taskCheckItemEntityToRecord,
    taskCheckItemRecordToEntity,
    taskCommentEntityToRecord,
    taskCommentRecordToEntity,
    taskEntityToRecord,
    taskRecordToEntity
} from '../persistence-local/converters/task'
import {
    pomodoroEntityToRecord,
    pomodoroRecordEntityToItem,
    pomodoroRecordItemToEntity,
    pomodoroRecordToEntity
} from '../persistence-local/converters/pomodoro'

/** 本地 record → domain 实体（解密明文；与 `sync-service` 记账 loser 同口径） */
type RecordEntityConverter = (record: Record<string, unknown>) => Promise<Record<string, unknown>>
/** domain 实体（或同形明文快照）→ 本地 record（加密落库） */
type EntityRecordConverter = (entity: Record<string, unknown>, userId: string) => Promise<unknown>

/** 单表冲突实体配置 */
export interface ConflictEntityConfig {
    /** 表名（= 远程资源名 = journal `table`） */
    table: string
    /** 读本地当前行（不存在 ⇒ undefined） */
    getRecord: (id: string) => Promise<Record<string, unknown> | undefined>
    /** 本地行 → 明文实体（只读对比用） */
    recordToEntity: RecordEntityConverter
    /** 明文快照 → 本地行（重试用） */
    entityToRecord: EntityRecordConverter
    /** 落库（**保留 per-row base**；直连表，不触发 markDirty） */
    putRecord: (record: unknown) => Promise<unknown>
}

const makeConfig = <T extends { id: string }>(
    table: string,
    tableRef: Table<T, string>,
    recordToEntity: RecordEntityConverter,
    entityToRecord: EntityRecordConverter
): ConflictEntityConfig => ({
    table,
    getRecord: (id) => tableRef.get(id) as Promise<Record<string, unknown> | undefined>,
    recordToEntity,
    entityToRecord,
    putRecord: (record) => putWithSyncBase(tableRef, record as T)
})

/** 业务同步 7 表的冲突实体映射（key 集 ≡ `SYNC_TABLES`，见一致性测试） */
export const CONFLICT_ENTITY_TABLES: ConflictEntityConfig[] = [
    makeConfig(
        'projects',
        localDatabase.projects,
        projectRecordToEntity as unknown as RecordEntityConverter,
        projectEntityToRecord as unknown as EntityRecordConverter
    ),
    makeConfig(
        'tags',
        localDatabase.tags,
        tagRecordToEntity as unknown as RecordEntityConverter,
        tagEntityToRecord as unknown as EntityRecordConverter
    ),
    makeConfig(
        'tasks',
        localDatabase.tasks,
        taskRecordToEntity as unknown as RecordEntityConverter,
        taskEntityToRecord as unknown as EntityRecordConverter
    ),
    makeConfig(
        'taskCheckItems',
        localDatabase.taskCheckItems,
        taskCheckItemRecordToEntity as unknown as RecordEntityConverter,
        taskCheckItemEntityToRecord as unknown as EntityRecordConverter
    ),
    makeConfig(
        'taskComments',
        localDatabase.taskComments,
        taskCommentRecordToEntity as unknown as RecordEntityConverter,
        taskCommentEntityToRecord as unknown as EntityRecordConverter
    ),
    makeConfig(
        'pomodoros',
        localDatabase.pomodoros,
        pomodoroRecordToEntity as unknown as RecordEntityConverter,
        pomodoroEntityToRecord as unknown as EntityRecordConverter
    ),
    makeConfig(
        'pomodoroRecords',
        localDatabase.pomodoroRecords,
        pomodoroRecordItemToEntity as unknown as RecordEntityConverter,
        pomodoroRecordEntityToItem as unknown as EntityRecordConverter
    )
]

/** 按表名取冲突实体配置（无映射 ⇒ undefined） */
export const findConflictEntity = (table: string): ConflictEntityConfig | undefined =>
    CONFLICT_ENTITY_TABLES.find((config) => config.table === table)