import type { TagPreferenceEntity } from '@nao-todo/domain-tag'
import { TagPreferenceRepository } from '@nao-todo/domain-tag'
import type { GoAsync } from '@nao-todo/shared'
import { tagPreferenceEntityToRecord, tagPreferenceRecordToEntity } from '../converters/preference'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'

/**
 * 本地标签偏好仓储实现
 */
export class LocalTagPreferenceRepoImpl implements TagPreferenceRepository {
    constructor(private db: NaoTodoLocalDatabase = localDatabase) {}

    async get(id: string): GoAsync<TagPreferenceEntity> {
        try {
            const record = await this.db.tagPreferences.get(id)
            if (!record) return [null, '标签偏好不存在']
            return [await tagPreferenceRecordToEntity(record), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async save(updatedEntity: TagPreferenceEntity): GoAsync<void> {
        try {
            await this.db.tagPreferences.put(await tagPreferenceEntityToRecord(updatedEntity))
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