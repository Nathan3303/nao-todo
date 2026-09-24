import type { NaoTodoLocalDatabase } from '../db/local-database'
import { isAbsentStamp, isNotDeleted } from '../utils'
import { nowCalibratedIso } from '../../persistence-sync/sync-config'
import { syncTracker } from '../../persistence-sync/sync-tracker'
import { putWithSyncBase } from './put-with-sync-base'

/** 归档级联动作 */
export type ProjectArchiveAction = 'archive' | 'unarchive'

/**
 * 清单归档/取消归档的本地级联（清单 + 其下任务，**同一 Dexie `rw` 事务**）
 *
 * 真源：ADR `docs/adr/2026-09-24-project-archive.md` r1 §4（Q1）
 *   - PA-5：清单与其下任务的写入在**同一事务**内 ⇒ 不得出现「清单已归档、任务未归档」的持久化中间态；
 *   - PA-6：**只改状态确实要变的行**（归档跳过已归档；恢复只恢复仍归档的）⇒ 不产生无谓 `markDirty` / 推送量；
 *   - PA-7：受影响任务**逐条 `markDirty`**（对齐服务端级联，离线一致）；
 *   - PA-4：归档路径**绝不**写 `deletedAt` / `deactivedAt`。
 *
 * @param db 本地数据库
 * @param projectId 清单 ID
 * @param userId 当前会话用户 ID（数据归属 + 任务过滤）
 * @param action 归档 / 取消归档
 * @returns 错误信息；成功为 `null`
 */
export const cascadeProjectArchive = async (
    db: NaoTodoLocalDatabase,
    projectId: string,
    userId: string,
    action: ProjectArchiveAction
): Promise<string | null> => {
    try {
        const now = nowCalibratedIso()
        const projectRecord = await db.projects.get(projectId)
        if (!projectRecord || projectRecord.userId !== userId) return '项目不存在'

        await db.transaction('rw', db.projects, db.tasks, db.syncQueue, async () => {
            // 1. 清单行：仅当状态确实要变时写（PA-6）
            const projectPatch = action === 'archive' ? now : null
            if (isAbsentStamp(projectRecord.archivedAt) !== isAbsentStamp(projectPatch)) {
                const nextProject = { ...projectRecord, archivedAt: projectPatch, updatedAt: now }
                await putWithSyncBase(db.projects, nextProject)
                await syncTracker.markDirty('projects', projectId, 'upsert', now)
            }

            // 2. 其下任务：逐条判定 + 逐条 markDirty（PA-6 / PA-7）
            const taskRecords = await db.tasks
                .where('userId')
                .equals(userId)
                .filter((r) => r.projectId === projectId)
                .toArray()
            for (const taskRecord of taskRecords) {
                // 已删除任务不参与级联（对齐服务端 SoftDelete/Archive 语义）
                if (!isNotDeleted(taskRecord.deletedAt)) continue
                if (action === 'archive') {
                    if (!isAbsentStamp(taskRecord.archivedAt)) continue
                } else if (isAbsentStamp(taskRecord.archivedAt)) {
                    continue
                }
                const nextTask = {
                    ...taskRecord,
                    archivedAt: action === 'archive' ? now : null,
                    updatedAt: now
                }
                await putWithSyncBase(db.tasks, nextTask)
                await syncTracker.markDirty('tasks', taskRecord.id, 'upsert', now)
            }
        })
        return null
    } catch (err) {
        return String(err)
    }
}