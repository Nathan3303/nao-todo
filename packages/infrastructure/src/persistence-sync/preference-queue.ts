/**
 * 偏好队列（TASK-26 / M6；ADR-r2 §D-1b）
 * @description 偏好/设置面**独立于业务同步引擎**的回传载体：
 *              - 存储 = `meta` 表**单记录** `${userId}:preference-queue`（纯追加字段，
 *                **不 bump Dexie version、不加索引** ⇒ 不触 C-44，同 `mirror-status` 先例）；
 *              - 队列项**按单位去重**：`userConfig` 每用户一条；`projectPreference` 按 `projectId` 一条；
 *              - **不入 `syncQueue`**、**不产生业务 `markDirty`**、**不计入 `syncStatus.pendingCount`**（PS-1 / PS-10）；
 *              - 失败分类与退避**复用** `sync-retry` 原语（SHELL-06 C-38/C-39），不新增重试机制。
 * @see docs/adr/2026-09-23-local-preference-sync.md（§D-1b / §D-4 / PS-1 / PS-10）
 */
import {
    localDatabase,
    type MetaRecord,
    type PreferenceQueueItem
} from '../persistence-local/db/local-database'
import { backoffDelayMs, isRetryDue, type SyncErrorClass } from './sync-retry'

export type { PreferenceQueueItem }

/** 偏好队列在 `meta` 表中的主键后缀（非索引字段 ⇒ 不触 C-44） */
const PREFERENCE_QUEUE_SUFFIX = 'preference-queue'

/** 某用户偏好队列在 `meta` 表中的主键 */
export const preferenceQueueId = (userId: string): string => `${userId}:${PREFERENCE_QUEUE_SUFFIX}`

/** 队列项去重键（单位）：`userConfig` 每用户一条；`projectPreference` 按 `projectId` 一条 */
export const preferenceUnitKey = (item: {
    kind: PreferenceQueueItem['kind']
    projectId?: string
}): string =>
    item.kind === 'userConfig' ? 'userConfig' : `projectPreference:${item.projectId ?? ''}`

/** 读取偏好队列（无记录 ⇒ 空数组） */
export const loadPreferenceQueue = async (userId: string): Promise<PreferenceQueueItem[]> => {
    if (!userId) return []
    const record = await localDatabase.meta.get(preferenceQueueId(userId))
    return record?.preferenceQueue ?? []
}

/** 覆盖写入偏好队列（空队列 ⇒ 删除记录，避免残留） */
export const savePreferenceQueue = async (
    userId: string,
    items: PreferenceQueueItem[]
): Promise<void> => {
    if (!userId) return
    const id = preferenceQueueId(userId)
    if (items.length === 0) {
        await localDatabase.meta.delete(id)
        return
    }
    await localDatabase.meta.put({ id, preferenceQueue: items } satisfies MetaRecord)
}

/**
 * 入队偏好变更（**按单位去重**，多次改合并为最新）
 * @description 本地写成功**之后**调用（先本地后队列 ⇒ 本地永远是权威可读态）。
 *              同一单位再次变更 ⇒ 重置退避（`attempts`/`nextAttemptAt` 清空）⇒ 立即重推，
 *              避免「改了但仍在退避窗口」导致用户可见的长时间未回传。
 */
export const enqueuePreference = async (
    userId: string,
    item: Omit<
        PreferenceQueueItem,
        'createdAt' | 'attempts' | 'nextAttemptAt' | 'lastErrorClass'
    > & {
        createdAt?: string
    }
): Promise<PreferenceQueueItem[]> => {
    if (!userId) return []
    const items = await loadPreferenceQueue(userId)
    const key = preferenceUnitKey(item)
    const existing = items.find((candidate) => preferenceUnitKey(candidate) === key)
    const next: PreferenceQueueItem = {
        kind: item.kind,
        ...(item.projectId === undefined ? {} : { projectId: item.projectId }),
        // `createdAt` 保留**首次入队**时间（ADR §D-1b）；再次变更重置退避（attempts 清空）⇒ 立即重推
        createdAt: item.createdAt ?? existing?.createdAt ?? new Date().toISOString()
    }
    const merged = [...items.filter((candidate) => preferenceUnitKey(candidate) !== key), next]
    await savePreferenceQueue(userId, merged)
    return merged
}

/** 出队（推送成功后按单位移除） */
export const removePreferenceItem = async (
    userId: string,
    item: { kind: PreferenceQueueItem['kind']; projectId?: string }
): Promise<PreferenceQueueItem[]> => {
    if (!userId) return []
    const key = preferenceUnitKey(item)
    const items = await loadPreferenceQueue(userId)
    const merged = items.filter((existing) => preferenceUnitKey(existing) !== key)
    await savePreferenceQueue(userId, merged)
    return merged
}

/** 清空偏好队列（登出/清库随 `meta` 一并清除；此处供显式清理） */
export const clearPreferenceQueue = async (userId: string): Promise<void> => {
    if (!userId) return
    await localDatabase.meta.delete(preferenceQueueId(userId))
}

/** 到期（可推送）的队列项：旧记录无 `nextAttemptAt` 视为可立即推送（C-39/C-44） */
export const duePreferenceItems = (
    items: PreferenceQueueItem[],
    nowMs: number
): PreferenceQueueItem[] => items.filter((item) => isRetryDue(item, nowMs))

/**
 * 记录推送失败（复用 SHELL-06 三分类语义）
 * @description - `network`：**暂停不计数**（不递增 `attempts`，仅标记分类，由 `online`/定时触发重试）；
 *              - `business`：**指数退避**（`attempts+1` + `nextAttemptAt`）；
 *              - `credential`：标记分类，由调用方走会话失效路径（不静默吞）。
 */
export const markPreferenceItemFailed = async (
    userId: string,
    item: PreferenceQueueItem,
    errorClass: SyncErrorClass,
    nowMs: number
): Promise<void> => {
    if (!userId) return
    const key = preferenceUnitKey(item)
    const items = await loadPreferenceQueue(userId)
    const merged = items.map((existing) => {
        if (preferenceUnitKey(existing) !== key) return existing
        if (errorClass === 'business') {
            const attempts = (existing.attempts ?? 0) + 1
            return {
                ...existing,
                attempts,
                nextAttemptAt: new Date(nowMs + backoffDelayMs(attempts)).toISOString(),
                lastErrorClass: errorClass
            } satisfies PreferenceQueueItem
        }
        // network / credential：不消耗重试额度
        return { ...existing, lastErrorClass: errorClass } satisfies PreferenceQueueItem
    })
    await savePreferenceQueue(userId, merged)
}