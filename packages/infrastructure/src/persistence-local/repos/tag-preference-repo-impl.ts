import type { TagPreferenceEntity } from '@nao-todo/domain-tag'
import { TagPreferenceRepository } from '@nao-todo/domain-tag'
import type { GoAsync } from '@nao-todo/shared'
import { getRequesterImpl, type Requester } from '@nao-todo/shared/requester'
import { tagPreferenceEntityToRecord, tagPreferenceRecordToEntity } from '../converters/preference'
import type { NaoTodoLocalDatabase, TagPreferenceRecord } from '../db/local-database'
import { localDatabase } from '../db/local-database'
import { putWithSyncBase } from './put-with-sync-base'
import { localSession } from '../session/local-session'
import {
    defaultTagPreferenceRes2Entity,
    tagPreferenceRes2Entity
} from '../../persistence-go/tag/converters'
import type { ResponseData, TagPreferenceRes } from '../../persistence-go/models'
import { getJWTFromLocalStorage } from '../../persistence-go/utils'
import { isRemoteNewer, markPreferenceDirty } from '../../persistence-sync/preference-sync'
import { loadPreferenceQueue } from '../../persistence-sync/preference-queue'

/** 服务端标签偏好获取成功码（DP-5 契约） */
const TAG_PREFERENCE_GET_CODE = 30050

/** 鉴权头（无 localStorage 环境/异常 ⇒ 空头，由请求器归一化） */
const authHeaders = (): Record<string, string> => {
    try {
        return { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
    } catch {
        return {}
    }
}

/**
 * 本地标签偏好仓储实现（DP-5）
 * @description JSON 配置字段加密存储，按 tagId 查询；
 *              读路径 = **本地优先 + 读时对账**（本地缺失 ⇒ 拉取恢复；本地 base 落后服务端 ⇒ 远端胜）；
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
                // §9.4.1 读时对账升级：本地 base 落后服务端 ⇒ 远端胜（未推本地修改除外，PS-1b）
                const reconciled = await this.reconcileWithRemote(id, userId, record)
                if (reconciled) return [reconciled, null]
                return [await tagPreferenceRecordToEntity(record), null]
            }
            // 本地缺失（换设备 / 清缓存 / 登出重登）⇒ 读时对账：拉服务端并落本地（恢复路径）
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

    /**
     * 读时对账（§9.4.1）：本地已有行 ⇒ 核对服务端版本，服务端更新则**远端胜**。
     * @description - 本地无 per-row base（未确认过服务端版本的新写/存量）⇒ **本地优先**，不发请求；
     *              - 本地有**待推修改**（偏好队列中）⇒ **不覆盖**（否则未推本地值被冲掉，PS-1b）；
     *              - 服务端 `updatedAt > base` ⇒ 应用远端并落新 base；否则返回 null（本地优先）。
     */
    private async reconcileWithRemote(
        id: string,
        userId: string,
        record: TagPreferenceRecord
    ): Promise<TagPreferenceEntity | null> {
        const base = record.syncedServerUpdatedAt
        if (!base) return null
        const queue = await loadPreferenceQueue(userId)
        if (queue.some((item) => item.kind === 'tagPreference' && item.tagId === id)) return null
        const remote = await this.fetchRemotePreference(id)
        if (!remote || !isRemoteNewer(remote.updatedAt, base)) return null
        await this.persistRemotePreference(remote, userId)
        return remote
    }

    /** 读时对账：本地缺失时从服务端恢复该标签偏好（ADR §9.4.2） */
    private async restoreFromRemote(
        id: string,
        userId: string
    ): Promise<TagPreferenceEntity | null> {
        const entity = await this.fetchRemotePreference(id)
        if (!entity) return null
        await this.persistRemotePreference(entity, userId)
        return entity
    }

    /** 拉取服务端标签偏好（仅 GET；失败/无数据/非成功码 ⇒ null） */
    private async fetchRemotePreference(id: string): Promise<TagPreferenceEntity | null> {
        try {
            const response = await this.requester.get(`/tags/${id}/preference`, {
                headers: authHeaders()
            })
            const res = response.data as ResponseData
            if (res?.code !== TAG_PREFERENCE_GET_CODE) return null
            return tagPreferenceRes2Entity(res.data as TagPreferenceRes)
        } catch {
            return null
        }
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