// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { syncTracker } from '../../persistence-sync/sync-tracker'
import { BUSINESS_TABLES, localDatabase } from '../db/local-database'
import { PENDING_WIPE_META_ID, deletionService } from '../deletion/deletion-service'
import { PLAINTEXT_NOTICE_ACK_KEY } from '@nao-todo/shared/constants'
import {
    DEVICE_LEVEL_STORAGE_KEYS,
    USER_SCOPED_STORAGE_KEYS,
    clearUserScopedLocalStorage
} from '../deletion/local-storage-policy'

/**
 * T106 登出清库（AC5 / AC5b / C-52 / C-53 / C-54）
 * @description
 * - AC5：`wipeUserData` 清空目标用户 localStorage 业务键 + IndexedDB（11 业务表 + meta +
 *   syncQueue + syncCursor），**保留 `nao.deviceId`**；崩溃后 `resumePendingWipe` 补清（C-53）。
 * - AC5b：同设备 A→B 切换 ⇒ A 的 11 张业务表零残留、**A 的 `deletionSchedules` 保留**、
 *   不清任何其它用户记录（PM [T106] Q1=(a) 裁定）。
 * - C-54：脏队列权威口径 = `syncTracker.countDirty(userId)`（非 `syncStatus.pendingCount`）。
 */

const USER_A = 'user-a'
const USER_B = 'user-b'

const putRaw = async (table: string, record: Record<string, unknown>): Promise<void> => {
    await localDatabase.table(table).put(record)
}

/** 为指定用户造全量本地数据（11 业务表 + meta + syncQueue + syncCursor + deletionSchedules） */
const seedUser = async (userId: string): Promise<void> => {
    for (const tableName of BUSINESS_TABLES) {
        await putRaw(tableName, { id: `${tableName}-${userId}`, userId })
    }
    await localDatabase.meta.put({
        id: `${userId}:key-bundle`,
        salt: 's',
        iv: 'i',
        wrappedDek: 'w'
    })
    await localDatabase.meta.put({ id: `${userId}:plaintext-migrated`, migratedAt: 'now' })
    await putRaw('syncQueue', {
        id: `${userId}:tasks:${userId}-task`,
        userId,
        table: 'tasks',
        entityId: `${userId}-task`,
        action: 'upsert',
        localUpdatedAt: 'now',
        retryCount: 0,
        createdAt: 'now',
        updatedAt: 'now'
    })
    await putRaw('syncCursor', {
        id: `${userId}:tasks`,
        userId,
        table: 'tasks',
        lastPullAt: 'now',
        lastPullId: '0',
        updatedAt: 'now'
    })
    await putRaw('deletionSchedules', {
        id: userId,
        deadline: '2099-01-01T00:00:00.000Z',
        createdAt: 'now'
    })
}

/** 该用户在某表的记录数 */
const countOwned = (tableName: string, userId: string): Promise<number> =>
    localDatabase.table(tableName).where('userId').equals(userId).count()

const resetDatabase = async (): Promise<void> => {
    await Promise.all(
        [
            ...(BUSINESS_TABLES as readonly string[]),
            'meta',
            'deletionSchedules',
            'syncQueue',
            'syncCursor'
        ].map((tableName) => localDatabase.table(tableName).clear())
    )
}

describe('T106 wipeUserData / 登出清库（AC5）', () => {
    beforeEach(async () => {
        await resetDatabase()
        localStorage.clear()
        localStorage.setItem('nao.deviceId', 'device-1')
        localStorage.setItem(USER_SCOPED_STORAGE_KEYS[0]!, 'jwt')
    })

    it('清空目标用户 11 业务表 + meta（密钥包/迁移标记）+ syncQueue + syncCursor', async () => {
        await seedUser(USER_A)
        await seedUser(USER_B)

        await deletionService.wipeUserData(USER_A)

        for (const tableName of BUSINESS_TABLES) {
            expect(await countOwned(tableName, USER_A)).toBe(0)
            // 多用户隔离：他人记录不得被误清
            expect(await countOwned(tableName, USER_B)).toBe(1)
        }
        expect(await localDatabase.meta.get(`${USER_A}:key-bundle`)).toBeUndefined()
        expect(await localDatabase.meta.get(`${USER_A}:plaintext-migrated`)).toBeUndefined()
        expect(await localDatabase.meta.get(`${USER_B}:key-bundle`)).toBeDefined()
        expect(await countOwned('syncQueue', USER_A)).toBe(0)
        expect(await countOwned('syncQueue', USER_B)).toBe(1)
        expect(await countOwned('syncCursor', USER_A)).toBe(0)
        expect(await countOwned('syncCursor', USER_B)).toBe(1)
    })

    it('AC5：localStorage 业务键清空，nao.deviceId 保留，pendingWipe 标记清空', async () => {
        await seedUser(USER_A)
        localStorage.setItem(USER_SCOPED_STORAGE_KEYS[2]!, 'confirm')
        localStorage.setItem('TABLE_CONFIG_tasks', '{}')
        localStorage.setItem('UNKNOWN_BUSINESS_KEY', 'x')

        await deletionService.wipeUserData(USER_A)

        expect(localStorage.getItem('nao.deviceId')).toBe('device-1')
        for (const key of USER_SCOPED_STORAGE_KEYS) {
            expect(localStorage.getItem(key)).toBeNull()
        }
        expect(localStorage.getItem('TABLE_CONFIG_tasks')).toBeNull()
        expect(localStorage.getItem('UNKNOWN_BUSINESS_KEY')).toBeNull()
        expect(await localDatabase.meta.get(PENDING_WIPE_META_ID)).toBeUndefined()
    })

    it('C-53：崩溃后 resumePendingWipe 补清（标记存在 ⇒ 补清；无标记 ⇒ false）', async () => {
        await seedUser(USER_A)
        await seedUser(USER_B)
        // 模拟「标记已提交但清库未完成」后崩溃
        await localDatabase.meta.put({ id: PENDING_WIPE_META_ID, pendingWipe: USER_A })
        expect(await countOwned('projects', USER_A)).toBe(1)

        expect(await deletionService.resumePendingWipe()).toBe(true)

        expect(await countOwned('projects', USER_A)).toBe(0)
        expect(await localDatabase.meta.get(PENDING_WIPE_META_ID)).toBeUndefined()
        // 他人数据不受影响
        expect(await countOwned('projects', USER_B)).toBe(1)
        // 幂等：无标记时不再执行
        expect(await deletionService.resumePendingWipe()).toBe(false)
    })
})

describe('T106 账号切换清库（AC5b）', () => {
    beforeEach(async () => {
        await resetDatabase()
        localStorage.clear()
    })

    it('A→B：A 的 11 业务表零残留；A 的 deletionSchedules 保留；B 记录不动', async () => {
        await seedUser(USER_A)
        await seedUser(USER_B)

        // 切换账号 = 先对 A 执行登出清库语义
        await deletionService.wipeUserData(USER_A)

        for (const tableName of BUSINESS_TABLES) {
            expect(await countOwned(tableName, USER_A)).toBe(0)
            expect(await countOwned(tableName, USER_B)).toBe(1)
        }
        // PM [T106] Q1=(a)：登出/切换保留目标用户自己的「注销宽限期」调度
        expect(await localDatabase.deletionSchedules.get(USER_A)).toBeDefined()
        expect(await localDatabase.deletionSchedules.get(USER_B)).toBeDefined()
    })
})

describe('T106 脏队列护栏口径（C-54）', () => {
    beforeEach(async () => {
        await resetDatabase()
    })

    it('countDirty(userId) 为权威即时口径，按 userId 过滤', async () => {
        await putRaw('syncQueue', {
            id: `${USER_A}:tasks:a1`,
            userId: USER_A,
            table: 'tasks',
            entityId: 'a1',
            action: 'upsert',
            localUpdatedAt: 'now',
            retryCount: 0,
            createdAt: 'now',
            updatedAt: 'now'
        })
        await putRaw('syncQueue', {
            id: `${USER_A}:tasks:a2`,
            userId: USER_A,
            table: 'tasks',
            entityId: 'a2',
            action: 'delete',
            localUpdatedAt: 'now',
            retryCount: 0,
            createdAt: 'now',
            updatedAt: 'now'
        })
        await putRaw('syncQueue', {
            id: `${USER_B}:tasks:b1`,
            userId: USER_B,
            table: 'tasks',
            entityId: 'b1',
            action: 'upsert',
            localUpdatedAt: 'now',
            retryCount: 0,
            createdAt: 'now',
            updatedAt: 'now'
        })

        expect(await syncTracker.countDirty(USER_A)).toBe(2)
        expect(await syncTracker.countDirty(USER_B)).toBe(1)
        expect(await syncTracker.countDirty('user-c')).toBe(0)

        // 清库后脏队列归零（同事务内删除）
        await deletionService.wipeUserData(USER_A)
        expect(await syncTracker.countDirty(USER_A)).toBe(0)
        expect(await syncTracker.countDirty(USER_B)).toBe(1)
    })
})

describe('T106 localStorage 黑白名单（C-52）', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('设备级键保留；身份/业务级键（含前缀与未登记键）清除', () => {
        for (const key of DEVICE_LEVEL_STORAGE_KEYS) localStorage.setItem(key, 'keep')
        localStorage.setItem('USER_JWT', 'jwt')
        localStorage.setItem('TABLE_CONFIG_tasks', '{}')
        localStorage.setItem('SOME_FUTURE_KEY', 'x')

        clearUserScopedLocalStorage()

        for (const key of DEVICE_LEVEL_STORAGE_KEYS) {
            expect(localStorage.getItem(key)).toBe('keep')
        }
        expect(localStorage.getItem('USER_JWT')).toBeNull()
        expect(localStorage.getItem('TABLE_CONFIG_tasks')).toBeNull()
        expect(localStorage.getItem('SOME_FUTURE_KEY')).toBeNull()
    })

    it('明文告知已读标记为设备级 ⇒ 登出清库后保留（防重复弹出）', () => {
        localStorage.setItem(PLAINTEXT_NOTICE_ACK_KEY, '1')
        localStorage.setItem('USER_JWT', 'jwt')

        clearUserScopedLocalStorage()

        expect(localStorage.getItem(PLAINTEXT_NOTICE_ACK_KEY)).toBe('1')
        expect(localStorage.getItem('USER_JWT')).toBeNull()
    })
})