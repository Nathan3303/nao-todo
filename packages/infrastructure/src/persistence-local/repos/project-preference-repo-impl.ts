import type { ProjectPreferenceEntity } from '@nao-todo/domain-project'
import { ProjectPreferenceRepository } from '@nao-todo/domain-project'
import type { GoAsync } from '@nao-todo/shared'
import { getRequesterImpl, type Requester } from '@nao-todo/shared/requester'
import {
    projectPreferenceEntityToRecord,
    projectPreferenceRecordToEntity
} from '../converters/preference'
import type { NaoTodoLocalDatabase, ProjectPreferenceRecord } from '../db/local-database'
import { localDatabase } from '../db/local-database'
import { putWithSyncBase } from './put-with-sync-base'
import { localSession } from '../session/local-session'
import {
    defaultProjectPreferenceRes2Entity,
    projectPreferenceRes2Entity
} from '../../persistence-go/project/converters'
import type { ProjectPreferenceRes, ResponseData } from '../../persistence-go/models'
import { getJWTFromLocalStorage } from '../../persistence-go/utils'
import { markPreferenceDirty, isRemoteNewer } from '../../persistence-sync/preference-sync'
import { loadPreferenceQueue } from '../../persistence-sync/preference-queue'

/** 服务端普通清单偏好获取成功码（T130 契约） */
const PROJECT_PREFERENCE_GET_CODE = 20080

/** 鉴权头（无 localStorage 环境/异常 ⇒ 空头，由请求器归一化） */
const authHeaders = (): Record<string, string> => {
    try {
        return { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
    } catch {
        return {}
    }
}

/**
 * 本地项目偏好仓储实现
 * @description JSON 配置字段加密存储，按 projectId 查询；
 *              读路径 = **本地优先 + 读时对账**（本地缺失 ⇒ 拉取恢复；本地 base 落后服务端 ⇒ 远端胜）。
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
                // §9.4.1 读时对账升级：本地 base 落后服务端 ⇒ 远端胜（未推本地修改除外，PS-1b）
                const reconciled = await this.reconcileWithRemote(projectId, userId, record)
                if (reconciled) return [reconciled, null]
                return [await projectPreferenceRecordToEntity(record), null]
            }
            // 本地缺失（换设备 / 清缓存 / 登出重登）⇒ 读时对账：拉服务端并落本地（恢复路径）
            const restored = await this.restoreFromRemote(projectId, userId)
            if (restored) return [restored, null]
            // 与远程行为一致：无偏好时返回默认偏好（viewType=table），不报错
            return [defaultProjectPreferenceRes2Entity(projectId), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    /**
     * 读时对账：本地缺失时从服务端恢复该清单偏好（ADR §D-1b「按行读时对账」）
     * @description 仅在**本地缺失**时拉取（本地有值即本地优先）。服务端有数据 ⇒ **直接落库**，
     *              **不入偏好队列**（来源是服务端而非用户改动 ⇒ 入队会用默认/陈旧值反向覆盖服务端）。
     *              网络不可达 / 无数据 / 非成功码 ⇒ 返回 null（本地优先，不阻断读路径）。
     */
    private async restoreFromRemote(
        projectId: string,
        userId: string
    ): Promise<ProjectPreferenceEntity | null> {
        const entity = await this.fetchRemotePreference(projectId)
        if (!entity) return null
        await this.persistRemotePreference(entity, userId)
        return entity
    }

    /**
     * 读时对账（§9.4.1）：本地已有行 ⇒ 核对服务端版本，服务端更新则**远端胜**。
     * @description - 本地无 per-row base（未确认过服务端版本的新写/存量）⇒ **本地优先**，不发请求；
     *              - 本地有**待推修改**（偏好队列中）⇒ **不覆盖**（否则未推本地值被冲掉，PS-1b）；
     *              - 服务端 `updatedAt > base` ⇒ 应用远端并落新 base；否则返回 null（本地优先）。
     */
    private async reconcileWithRemote(
        projectId: string,
        userId: string,
        record: ProjectPreferenceRecord
    ): Promise<ProjectPreferenceEntity | null> {
        const base = record.syncedServerUpdatedAt
        if (!base) return null
        const queue = await loadPreferenceQueue(userId)
        if (queue.some((item) => item.kind === 'projectPreference' && item.projectId === projectId))
            return null
        const remote = await this.fetchRemotePreference(projectId)
        if (!remote || !isRemoteNewer(remote.updatedAt, base)) return null
        await this.persistRemotePreference(remote, userId)
        return remote
    }

    /** 拉取服务端普通清单偏好（仅 GET；失败/无数据/非成功码 ⇒ null） */
    private async fetchRemotePreference(
        projectId: string
    ): Promise<ProjectPreferenceEntity | null> {
        try {
            const response = await this.requester.get(`/projects/${projectId}/preference`, {
                headers: authHeaders()
            })
            const res = response.data as ResponseData
            if (res?.code !== PROJECT_PREFERENCE_GET_CODE) return null
            return projectPreferenceRes2Entity(res.data as ProjectPreferenceRes)
        } catch {
            return null
        }
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