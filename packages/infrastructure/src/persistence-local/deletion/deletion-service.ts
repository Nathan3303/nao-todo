import dayjs from 'dayjs'
import { BUSINESS_TABLES, localDatabase, type MetaRecord } from '../db/local-database'
import {
    clearUserScopedLocalStorage,
    type ClearUserScopedStorageOptions
} from './local-storage-policy'
import { logStructured, STRUCTURED_LOG_EVENTS } from '../../observability/structured-log'

/**
 * 注销反悔期天数（与后端一致：注销后 7 天内可恢复，到期彻底删除）
 */
const GRACE_DAYS = 7

/**
 * 清库可重入标记在 `meta` 表中的主键（C-53）
 * @description 值 = 待清 `userId`；与清库同事务提交，启动时据此补清，清库完成后删除。
 */
export const PENDING_WIPE_META_ID = 'pendingWipe'

/**
 * `wipeUserData` 选项（清库语境，C-52 / C-53 r11，DEF-34）
 * @description 判据 = **调用语境**（调用方显式传入），**不以 `userId` 相等为判据**：
 *              补清（`resumePendingWipe`）时无论标记属于当前用户还是上一账号，
 *              都必须保留**当前已建立会话**的凭据键。
 */
export type WipeUserDataOptions = ClearUserScopedStorageOptions

/**
 * 本地数据删除调度服务
 * @description 注销成功时记录 `now + 7 天` 的删除截止时间；
 *              启动时检查：截止时间已过则清空该用户全部本地数据（业务表 + 密钥包 + 调度记录）。
 *              7 天反悔期内恢复账户则取消调度，本地数据保留。
 */
export class DeletionService {
    /**
     * 注销成功：记录删除调度（now + 7 天）
     * @param userId 用户 ID
     */
    async recordDeletion(userId: string): Promise<void> {
        if (!userId) return
        const now = new Date()
        await localDatabase.deletionSchedules.put({
            id: userId,
            deadline: dayjs(now).add(GRACE_DAYS, 'day').toISOString(),
            createdAt: now.toISOString()
        })
    }

    /**
     * 恢复账户成功：取消删除调度（本地数据保留）
     * @param userId 用户 ID
     */
    async cancelDeletion(userId: string): Promise<void> {
        if (!userId) return
        await localDatabase.deletionSchedules.delete(userId)
    }

    /**
     * 按用户清空本地全部数据（**单一真源**：登出 / 注销到期 / 切换账号共用，C-52 r2 / C-64）
     * @description 单事务内清 11 张业务表 + `meta`（按 `userId:` 前缀，含密钥包与迁移完成标记）
     *              + `syncQueue` + `syncCursor`（全部按 `userId` 过滤，**禁整库清、禁清他人**）；
     *              同一事务写入 `meta.pendingWipe` 标记（C-53 可重入），随后按键清 localStorage
     *              业务键，最后删除标记。
     *              **不删** `deletionSchedules`（PM [T106] Q1=(a)：登出/切换须保留「注销宽限期」状态；
     *              仅 `checkAndCleanExpired` 在本方法返回后删自己的调度）。
     *              **语境分流（C-52 / C-53 r11，DEF-34）**：`options.preserveActiveSessionCredentials`
     *              = `true`（补清语境）⇒ localStorage 侧保留当前会话凭据键；默认 `false` = 终结会话语境
     *              （C-52 逐字不变）。IndexedDB 侧两种语境完全一致。
     * @param userId 用户 ID
     * @param options 清库语境选项（默认 = 终结会话语境）
     */
    async wipeUserData(userId: string, options: WipeUserDataOptions = {}): Promise<void> {
        if (!userId) return
        logStructured('info', STRUCTURED_LOG_EVENTS.WIPE_STARTED, { userId })
        const tables = BUSINESS_TABLES as readonly string[]
        await localDatabase.transaction(
            'rw',
            [...tables, 'meta', 'syncQueue', 'syncCursor'],
            async () => {
                // C-53：标记与清库同一事务提交 ⇒ 崩溃后由 resumePendingWipe 补清
                await localDatabase.meta.put({
                    id: PENDING_WIPE_META_ID,
                    pendingWipe: userId
                } satisfies MetaRecord)
                for (const tableName of tables) {
                    await localDatabase.table(tableName).where('userId').equals(userId).delete()
                }
                // meta 按 userId 前缀过滤（密钥包 `${userId}:key-bundle` + 迁移完成标记）
                await localDatabase.meta
                    .filter(
                        (record) =>
                            typeof record.id === 'string' && record.id.startsWith(`${userId}:`)
                    )
                    .delete()
                // 同步元数据一并清理：防残留脏队列把注销前未推送的本地修改在恢复后继续推送到远程
                await localDatabase.syncQueue.where('userId').equals(userId).delete()
                await localDatabase.syncCursor.where('userId').equals(userId).delete()
            }
        )
        // C-52：按键删除 localStorage 业务键（禁 clear()；设备级键保留）
        // C-52 / r11：补清语境额外保留当前会话凭据键（DEF-34）
        clearUserScopedLocalStorage(options)
        // C-53：清库完成后删除标记
        await localDatabase.meta.delete(PENDING_WIPE_META_ID)
        logStructured('info', STRUCTURED_LOG_EVENTS.WIPE_COMPLETED, {
            userId,
            tables: tables.length
        })
    }

    /**
     * 启动补清：存在 `meta.pendingWipe` 标记则补完清库（C-53）
     * @description **补清语境**（C-53 / r11）：补的是上一次登出的收尾；其间若已重新登录，
     *              当前会话凭据**不得**被删除 ⇒ `preserveActiveSessionCredentials: true`。
     *              IndexedDB 侧清库不变（仍按标记里的 `userId` 过滤）。
     * @returns 是否执行了补清
     */
    async resumePendingWipe(): Promise<boolean> {
        const marker = await localDatabase.meta.get(PENDING_WIPE_META_ID)
        const userId = marker?.pendingWipe
        if (!userId) return false
        await this.wipeUserData(userId, { preserveActiveSessionCredentials: true })
        return true
    }

    /**
     * 启动检查：删除截止时间已过则清空该用户全部本地数据
     * @param userId 当前用户 ID
     * @returns 是否执行了清理
     */
    async checkAndCleanExpired(userId: string): Promise<boolean> {
        if (!userId) return false
        const schedule = await localDatabase.deletionSchedules.get(userId)
        if (!schedule) return false
        // 未到期：反悔期内，数据保留
        if (new Date(schedule.deadline).getTime() > Date.now()) return false
        // 到期：清库（单一真源）+ 删自己的调度（PM [T106] Q1=(a)：仅本路径删调度）
        await this.wipeUserData(userId)
        await localDatabase.deletionSchedules.delete(userId)
        return true
    }
}

/**
 * 删除调度服务单例
 */
export const deletionService = new DeletionService()