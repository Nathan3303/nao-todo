import type { ProjectPreferenceEntity } from '@nao-todo/domain-project'
import { ProjectPreferenceRepository } from '@nao-todo/domain-project'
import type { GoAsync } from '@nao-todo/shared'
import { getRequesterImpl, type Requester } from '@nao-todo/shared/requester'
import {
    projectPreferenceEntityToRecord,
    projectPreferenceRecordToEntity
} from '../converters/preference'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'
import { putWithSyncBase } from './put-with-sync-base'
import { localSession } from '../session/local-session'
import { defaultProjectPreferenceRes2Entity } from '../../persistence-go/project/converters'
import { markPreferenceDirty } from '../../persistence-sync/preference-sync'
import { fetchRemoteProjectPreference } from '../../persistence-sync/preference-remote'

/**
 * 本地项目偏好仓储实现
 * @description JSON 配置字段加密存储，按 projectId 查询；
 *              读路径 = **本地优先**（本地有行 ⇒ **立即返回，不发网络请求**）；
 *              本地缺失 ⇒ 读时恢复（拉服务端并落本地）；
 *              base 落后服务端的**远端胜对账**改由触发点后台完成（`reconcilePreferences`，§9.4.1）。
 */
export class LocalProjectPreferenceRepoImpl implements ProjectPreferenceRepository {
    constructor(
        private db: NaoTodoLocalDatabase = localDatabase,
        private requester: Requester = getRequesterImpl()
    ) {}

    /** 当前会话用户 ID（数据归属标识） */
    private get currentUserId(): string {
        return localSession.requireCurrentUserId()
    }

    async getByProjectId(projectId: string): GoAsync<ProjectPreferenceEntity> {
        try {
            // C-55：先硬失败取数（空会话 ⇒ 不进入库读，避免“无偏好 ⇒ 返回默认”的成功路径）
            const userId = this.currentUserId
            const record = await this.db.projectPreferences
                .where('projectId')
                .equals(projectId)
                .filter((r) => r.userId === userId)
                .first()
            if (record) {
                // 读路径本地优先：本地有行 ⇒ **立即返回，不发网络请求**（PS-12 / 本地即时）
                return [await projectPreferenceRecordToEntity(record), null]
            }
            // 本地缺失（换设备 / 清缓存 / 登出重登）⇒ 拉服务端并落本地（恢复路径）
            const restored = await this.restoreFromRemote(projectId, userId)
            if (restored) return [restored, null]
            // 与远程行为一致：无偏好时返回默认偏好（viewType=table），不报错
            return [defaultProjectPreferenceRes2Entity(projectId), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    /**
     * 读时恢复：本地缺失时从服务端恢复该清单偏好（ADR §D-1b）
     * @description 仅在**本地缺失**时拉取（本地有行即本地优先）。服务端有数据 ⇒ **直接落库**，
     *              **不入偏好队列**（来源是服务端而非用户改动 ⇒ 入队会用默认/陈旧值反向覆盖服务端）。
     *              网络不可达 / 无数据 / 非成功码 ⇒ 返回 null（本地优先，不阻断读路径）。
     */
    private async restoreFromRemote(
        projectId: string,
        userId: string
    ): Promise<ProjectPreferenceEntity | null> {
        const entity = await fetchRemoteProjectPreference(this.requester, projectId)
        if (!entity) return null
        await this.persistRemotePreference(entity, userId)
        return entity
    }

    /** 落库远端记录并同时落 per-row 版本基线（§9.4.1；与业务面 pull 同源） */
    private async persistRemotePreference(
        entity: ProjectPreferenceEntity,
        userId: string
    ): Promise<void> {
        const record = await projectPreferenceEntityToRecord(entity, userId)
        await this.db.projectPreferences.put({
            ...record,
            syncedServerUpdatedAt: entity.updatedAt
        })
    }

    async save(updatedEntity: ProjectPreferenceEntity): GoAsync<void> {
        try {
            await putWithSyncBase(
                this.db.projectPreferences,
                await projectPreferenceEntityToRecord(updatedEntity, this.currentUserId)
            )
            // TASK-26 / M6：本地写成功后入偏好队列（**不入 syncQueue**）+ 防抖回传（按行）
            await markPreferenceDirty('projectPreference', updatedEntity.projectId)
            return null
        } catch (err) {
            return String(err)
        }
    }
}

/**
 * 创建本地项目偏好仓储实例
 */
export const newLocalProjectPreferenceRepository = (requester?: Requester) =>
    new LocalProjectPreferenceRepoImpl(localDatabase, requester ?? getRequesterImpl())