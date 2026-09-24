import { PLAIN_PREFIX } from '../crypto/crypto-service'
import type { MetaRecord } from '../db/local-database'
import { localDatabase } from '../db/local-database'
import {
    projectPreferenceEntityToRecord,
    projectPreferenceRecordToEntity,
    tagPreferenceEntityToRecord,
    tagPreferenceRecordToEntity
} from '../converters/preference'
import {
    pomodoroEntityToRecord,
    pomodoroRecordEntityToItem,
    pomodoroRecordItemToEntity,
    pomodoroRecordToEntity
} from '../converters/pomodoro'
import { projectEntityToRecord, projectRecordToEntity } from '../converters/project'
import { tagEntityToRecord, tagRecordToEntity } from '../converters/tag'
import {
    taskCheckItemEntityToRecord,
    taskCheckItemRecordToEntity,
    taskCommentEntityToRecord,
    taskCommentRecordToEntity,
    taskEntityToRecord,
    taskRecordToEntity
} from '../converters/task'
import { userEntityToRecord, userRecordToEntity } from '../converters/user'
import { logStructured, STRUCTURED_LOG_EVENTS } from '../../observability/structured-log'

/**
 * 历史密文 → 明文迁移器（C-47…C-51 / C-56）
 *
 * 设计要点：
 * - **直写表**（`recordToEntity → entityToRecord → bulkPut`），**绝不经 `repo.update()`** ⇒ 不 `markDirty`（C-48）；
 * - **批量事务**：全部记录在事务外完成转换（避免 WebCrypto 打断 Dexie 事务），单事务 `bulkPut` + 写完成标记（C-56/C-47）；
 * - **幂等可续跑**：已是 `plain:` 的记录跳过；事务原子提交 ⇒ 中断后重启自动续跑（C-50）；
 * - **跨实例选主**：`navigator.locks`（`ifAvailable`）避免多实例并发写同一批记录（C-57 未启用单实例锁时的代偿）。
 *
 * 不变量：`key-bundle` **不删**（唯一不可逆开关，须全库迁移完成 + 观察窗口后单独决策，C-51）。
 */

type RecordLike = Record<string, unknown>
type RecordToEntity = (record: RecordLike) => Promise<RecordLike>
type EntityToRecord = (entity: RecordLike, userId: string) => Promise<RecordLike>

interface MigrationTableConfig {
    table: string
    recordToEntity: RecordToEntity
    entityToRecord: EntityToRecord
    /** 该表内含密文的字段（用于跳过已迁移记录） */
    encryptedFields: readonly string[]
}

/** 跨实例迁移锁名（同 origin 内所有窗口/实例共享） */
const MIGRATION_LOCK_NAME = 'nao-todo:plaintext-migration'

/** 迁移完成标记在 `meta` 表中的主键后缀（非索引字段 ⇒ 不触 C-44） */
const MIGRATION_MARKER_SUFFIX = 'plaintext-migrated'

/** 含密文列的业务表（`userConfigs` 无密文字段，不参与迁移） */
const MIGRATION_TABLES: readonly MigrationTableConfig[] = [
    {
        table: 'projects',
        recordToEntity: projectRecordToEntity as unknown as RecordToEntity,
        entityToRecord: projectEntityToRecord as unknown as EntityToRecord,
        encryptedFields: ['name', 'description']
    },
    {
        table: 'projectPreferences',
        recordToEntity: projectPreferenceRecordToEntity as unknown as RecordToEntity,
        entityToRecord: projectPreferenceEntityToRecord as unknown as EntityToRecord,
        encryptedFields: ['getTasksOptions', 'columns']
    },
    {
        table: 'tags',
        recordToEntity: tagRecordToEntity as unknown as RecordToEntity,
        entityToRecord: tagEntityToRecord as unknown as EntityToRecord,
        encryptedFields: ['name', 'description']
    },
    {
        table: 'tagPreferences',
        recordToEntity: tagPreferenceRecordToEntity as unknown as RecordToEntity,
        entityToRecord: tagPreferenceEntityToRecord as unknown as EntityToRecord,
        encryptedFields: ['getTasksOptions', 'columns']
    },
    {
        table: 'tasks',
        recordToEntity: taskRecordToEntity as unknown as RecordToEntity,
        entityToRecord: taskEntityToRecord as unknown as EntityToRecord,
        encryptedFields: ['name', 'description']
    },
    {
        table: 'taskCheckItems',
        recordToEntity: taskCheckItemRecordToEntity as unknown as RecordToEntity,
        entityToRecord: taskCheckItemEntityToRecord as unknown as EntityToRecord,
        encryptedFields: ['name']
    },
    {
        table: 'taskComments',
        recordToEntity: taskCommentRecordToEntity as unknown as RecordToEntity,
        entityToRecord: taskCommentEntityToRecord as unknown as EntityToRecord,
        encryptedFields: ['content', 'avatar', 'nickname']
    },
    {
        table: 'pomodoros',
        recordToEntity: pomodoroRecordToEntity as unknown as RecordToEntity,
        entityToRecord: pomodoroEntityToRecord as unknown as EntityToRecord,
        encryptedFields: ['name', 'description']
    },
    {
        table: 'pomodoroRecords',
        recordToEntity: pomodoroRecordItemToEntity as unknown as RecordToEntity,
        entityToRecord: pomodoroRecordEntityToItem as unknown as EntityToRecord,
        encryptedFields: ['taskName', 'description', 'note']
    },
    {
        table: 'users',
        recordToEntity: userRecordToEntity as unknown as RecordToEntity,
        entityToRecord: userEntityToRecord as unknown as EntityToRecord,
        encryptedFields: ['email', 'nickname', 'avatar']
    }
]

/** 迁移完成标记记录主键 */
export const plaintextMigrationMarkerId = (userId: string): string =>
    `${userId}:${MIGRATION_MARKER_SUFFIX}`

export interface PlaintextMigrationResult {
    /** 本次是否真正执行了迁移（false = 已完成标记短路 / 未获跨实例锁） */
    ran: boolean
    /** 本次迁移的记录数 */
    migrated: number
    /** 因跨实例锁被占用而跳过（另一实例正在迁移，本实例双格式读取兜底） */
    lockSkipped: boolean
}

/** 是否已完成明文迁移（C-47 幂等短路判据） */
export const isPlaintextMigrationDone = async (userId: string): Promise<boolean> => {
    if (!userId) return false
    const marker = await localDatabase.meta.get(plaintextMigrationMarkerId(userId))
    return marker !== undefined
}

/** 记录是否已全部为明文（已是 `plain:` 的跳过，C-50） */
const isRecordMigrated = (config: MigrationTableConfig, record: RecordLike): boolean =>
    config.encryptedFields.every((field) => {
        const value = record[field]
        return (
            value === null ||
            value === undefined ||
            (typeof value === 'string' && value.startsWith(PLAIN_PREFIX))
        )
    })

/** 跨实例选主（navigator.locks 不可用时直接执行；迁移本身幂等） */
const withMigrationLock = async (
    run: () => Promise<PlaintextMigrationResult>
): Promise<PlaintextMigrationResult> => {
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
    if (!locks || typeof locks.request !== 'function') return run()
    let result: PlaintextMigrationResult = { ran: false, migrated: 0, lockSkipped: true }
    await locks.request(MIGRATION_LOCK_NAME, { ifAvailable: true }, async (lock) => {
        if (!lock) return
        result = await run()
    })
    return result
}

/**
 * 执行明文迁移（幂等；仅全库成功后写完成标记）
 * @param userId 用户 ID（记录按此过滤，禁跨用户）
 */
export const runPlaintextMigration = async (userId: string): Promise<PlaintextMigrationResult> => {
    if (!userId) return { ran: false, migrated: 0, lockSkipped: false }
    logStructured('info', STRUCTURED_LOG_EVENTS.MIGRATION_STARTED, { userId })
    const result = await withMigrationLock(async () => {
        if (await isPlaintextMigrationDone(userId)) {
            return { ran: false, migrated: 0, lockSkipped: false }
        }
        // 1. 事务外完成全部转换（WebCrypto 解密不得在 Dexie 事务内 await）
        const batches: { table: string; records: RecordLike[] }[] = []
        let migrated = 0
        for (const config of MIGRATION_TABLES) {
            const records = (await localDatabase
                .table(config.table)
                .where('userId')
                .equals(userId)
                .toArray()) as RecordLike[]
            const migratedRecords: RecordLike[] = []
            for (const record of records) {
                if (isRecordMigrated(config, record)) continue
                const entity = await config.recordToEntity(record)
                migratedRecords.push(await config.entityToRecord(entity, userId))
                migrated += 1
            }
            if (migratedRecords.length > 0) {
                batches.push({ table: config.table, records: migratedRecords })
            }
        }
        // 2. 单事务批量落库 + 完成标记（C-47：仅全库成功后写；C-56：禁逐条事务）
        await localDatabase.transaction(
            'rw',
            [...MIGRATION_TABLES.map((config) => config.table), 'meta'],
            async () => {
                for (const batch of batches) {
                    await localDatabase.table(batch.table).bulkPut(batch.records)
                }
                await localDatabase.meta.put({
                    id: plaintextMigrationMarkerId(userId),
                    migratedAt: new Date().toISOString()
                } satisfies MetaRecord)
            }
        )
        return { ran: true, migrated, lockSkipped: false }
    })
    logStructured('info', STRUCTURED_LOG_EVENTS.MIGRATION_COMPLETED, {
        userId,
        ran: result.ran,
        migrated: result.migrated,
        lockSkipped: result.lockSkipped
    })
    return result
}