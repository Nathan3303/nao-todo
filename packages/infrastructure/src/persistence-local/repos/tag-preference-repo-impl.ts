import type { TagPreferenceEntity } from '@nao-todo/domain-tag'
import { TagPreferenceRepository } from '@nao-todo/domain-tag'
import type { GoAsync } from '@nao-todo/shared'
import { getRequesterImpl, type Requester } from '@nao-todo/shared/requester'
import { tagPreferenceEntityToRecord, tagPreferenceRecordToEntity } from '../converters/preference'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'
import { putWithSyncBase } from './put-with-sync-base'
import { localSession } from '../session/local-session'
import { defaultTagPreferenceRes2Entity } from '../../persistence-go/tag/converters'
import { markPreferenceDirty } from '../../persistence-sync/preference-sync'
import { fetchRemoteTagPreference } from '../../persistence-sync/preference-remote'

/**
 * 本地标签偏好仓储实现（DP-5）
 * @description JSON 配置字段加密存储，按 tagId 查询；
 *              读路径 = **本地优先**（本地有行 ⇒ **立即返回，不发网络请求**）；
 *              本地缺失 ⇒ 读时恢复（拉服务端并落本地）；
 *              base 落后服务端的**远端胜对账**改由触发点后台完成（`reconcilePreferences`，§9.4.1）；
 *              本地写 ⇒ 入**独立偏好队列**（`kind: 'tagPreference'`；**不入 `syncQueue`**）。
 */
export class LocalTagPreferenceRepoImpl implements TagPreferenceRepository {
    constructor(
        private db: NaoTodoLocalDatabase = localDatabase,
        private requester: Requester = getRequesterImpl()
    ) {}

    /** 当前会话用户 ID（数据归属标识） */
    private get currentUserId(): string {
        return localSession.requireCurrentUserId()
    }

    async get(id: string): GoAsync<TagPreferenceEntity> {
        try {
            // C-55：先硬失败取数（空会话 ⇒ 不进入库读，避免“无偏好 ⇒ 返回默认”的成功路径）
            const userId = this.currentUserId
            // 接口语义：参数为 tagId（与远程 /tags/{tagId}/preference 一致），按 tagId 索引查询
            const record = await this.db.tagPreferences
                .where('tagId')
                .equals(id)
                .filter((r) => r.userId === userId)
                .first()
            if (record) {
                // 读路径本地优先：本地有行 ⇒ **立即返回，不发网络请求**（PS-12 / 本地即时）
                return [await tagPreferenceRecordToEntity(record), null]
            }
            // 本地缺失（换设备 / 清缓存 / 登出重登）⇒ 拉服务端并落本地（恢复路径）
            const restored = await this.restoreFromRemote(id, userId)
            if (restored) return [restored, null]
            // 与远程行为一致：无偏好时返回默认偏好（viewType=table，getTasksOptions 含 tagId 过滤），不报错
            return [defaultTagPreferenceRes2Entity(id), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async save(updatedEntity: TagPreferenceEntity): GoAsync<void> {
        try {
            await putWithSyncBase(
                this.db.tagPreferences,
                await tagPreferenceEntityToRecord(updatedEntity, this.currentUserId)
            )
            // DP-5：本地写成功后入偏好队列（**不入 syncQueue**）+ 防抖回传（按行）
            await markPreferenceDirty('tagPreference', undefined, updatedEntity.tagId)
            return null
        } catch (err) {
            return String(err)
        }
    }

    /** 读时恢复：本地缺失时从服务端恢复该标签偏好（ADR §9.4.2） */
    private async restoreFromRemote(
        id: string,
        userId: string
    ): Promise<TagPreferenceEntity | null> {
        const entity = await fetchRemoteTagPreference(this.requester, id)
        if (!entity) return null
        await this.persistRemotePreference(entity, userId)
        return entity
    }

    /** 落库远端记录并同时落 per-row 版本基线（§9.4.1；与业务面 pull 同源） */
    private async persistRemotePreference(
        entity: TagPreferenceEntity,
        userId: string
    ): Promise<void> {
        const record = await tagPreferenceEntityToRecord(entity, userId)
        await this.db.tagPreferences.put({
            ...record,
            syncedServerUpdatedAt: entity.updatedAt
        })
    }
}

/**
 * 创建本地标签偏好仓储实例
 */
export const newLocalTagPreferenceRepository = (requester?: Requester) =>
    new LocalTagPreferenceRepoImpl(localDatabase, requester ?? getRequesterImpl())