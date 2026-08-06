import dayjs from 'dayjs'
import { BUSINESS_TABLES, localDatabase } from '../db/local-database'

/**
 * 注销反悔期天数（与后端一致：注销后 7 天内可恢复，到期彻底删除）
 */
const GRACE_DAYS = 7

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
        // 到期：事务清空该用户业务数据、密钥包与调度记录
        const tables = BUSINESS_TABLES as readonly string[]
        await localDatabase.transaction(
            'rw',
            [...tables, 'meta', 'deletionSchedules'],
            async () => {
                for (const tableName of tables) {
                    await localDatabase.table(tableName).where('userId').equals(userId).delete()
                }
                await localDatabase.meta.delete(`${userId}:key-bundle`)
                await localDatabase.deletionSchedules.delete(userId)
            }
        )
        return true
    }
}

/**
 * 删除调度服务单例
 */
export const deletionService = new DeletionService()