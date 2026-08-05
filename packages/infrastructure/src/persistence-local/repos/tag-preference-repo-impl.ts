import type { TagPreferenceEntity } from '@nao-todo/domain-tag'
import { TagPreferenceRepository } from '@nao-todo/domain-tag'
import type { GoAsync } from '@nao-todo/shared'
import { tagPreferenceEntityToRecord, tagPreferenceRecordToEntity } from '../converters/preference'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'
import { localSession } from '../session/local-session'
import { defaultTagPreferenceRes2Entity } from '../../persistence-go/tag/converters'

/**
 * 本地标签偏好仓储实现
 */
export class LocalTagPreferenceRepoImpl implements TagPreferenceRepository {
    constructor(private db: NaoTodoLocalDatabase = localDatabase) {}

    /** 当前会话用户 ID（数据归属标识） */
    private get currentUserId(): string {
        return localSession.getCurrentUserId() ?? ''
    }

    async get(id: string): GoAsync<TagPreferenceEntity> {
        try {
            // 接口语义：参数为 tagId（与远程 /tags/{tagId}/preference 一致），按 tagId 索引查询
            const record = await this.db.tagPreferences
                .where('tagId')
                .equals(id)
                .filter((r) => r.userId === this.currentUserId)
                .first()
            // 与远程行为一致：无偏好时返回默认偏好（viewType=table），不报错
            if (!record) return [defaultTagPreferenceRes2Entity(), null]
            return [await tagPreferenceRecordToEntity(record), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async save(updatedEntity: TagPreferenceEntity): GoAsync<void> {
        try {
            await this.db.tagPreferences.put(
                await tagPreferenceEntityToRecord(updatedEntity, this.currentUserId)
            )
            return null
        } catch (err) {
            return String(err)
        }
    }
}

/**
 * 创建本地标签偏好仓储实例
 */
export const newLocalTagPreferenceRepository = () => new LocalTagPreferenceRepoImpl()