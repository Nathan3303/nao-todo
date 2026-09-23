/**
 * 镜像新鲜度持久化（T107b / C-60 冷启动离线）
 * @description 内存态 `syncStatus.mirrorPulledAt/mirrorTruncated` 冷启动归零 ⇒ 离线冷启动
 *              （本会话未成功拉取）会误显示「尚未同步完成」，即使磁盘已有镜像（AC8 缺口）。
 *              本模块把二者落到 `meta` 表（`${userId}:mirror-status`）：
 *              - 非索引字段 ⇒ 不触 C-44（协议冻结 / 记录字段纯追加）；
 *              - 直连表写入，**不触发 `markDirty`**（C-59：阶段一不得入队）；
 *              - `mirrorPulledAt === null` 仅表示「确实从未成功拉取过」，用于区分「空库」与
 *                「未同步完成」（C-60③ / AC9）。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-44/C-59/C-60）
 */
import { localDatabase, type MetaRecord } from '../persistence-local/db/local-database'

/** 镜像状态在 `meta` 表中的主键后缀（非索引字段 ⇒ 不触 C-44） */
const MIRROR_STATUS_SUFFIX = 'mirror-status'

/** 某用户镜像状态在 `meta` 表中的主键 */
const mirrorStatusId = (userId: string): string => `${userId}:${MIRROR_STATUS_SUFFIX}`

/** 持久化的镜像新鲜度 */
export interface PersistedMirrorStatus {
    /** 镜像完整拉取时间（ISO；从未成功完整拉取为 null） */
    mirrorPulledAt: string | null
    /** 镜像是否被续拉上界截断 */
    mirrorTruncated: boolean
}

/**
 * 落盘镜像新鲜度（成功完整拉取 / 截断时调用）
 * @description 空 `userId` 硬失败（C-55：不得退化为空用户读写）
 */
export const saveMirrorStatus = async (
    userId: string,
    status: PersistedMirrorStatus
): Promise<void> => {
    if (!userId) return
    await localDatabase.meta.put({
        id: mirrorStatusId(userId),
        mirrorPulledAt: status.mirrorPulledAt ?? undefined,
        mirrorTruncated: status.mirrorTruncated
    } satisfies MetaRecord)
}

/**
 * 读回镜像新鲜度（启动/初始化时）
 * @returns 从未落盘（该用户从未成功拉取过）时为 null，调用方据此保持内存态默认值
 */
export const loadMirrorStatus = async (userId: string): Promise<PersistedMirrorStatus | null> => {
    if (!userId) return null
    const record = await localDatabase.meta.get(mirrorStatusId(userId))
    if (!record) return null
    return {
        mirrorPulledAt: record.mirrorPulledAt ?? null,
        mirrorTruncated: record.mirrorTruncated ?? false
    }
}