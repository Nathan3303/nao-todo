import type { ProjectPreferenceEntity } from '@nao-todo/domain-project'
import { ProjectPreferenceRepository } from '@nao-todo/domain-project'
import type { GoAsync } from '@nao-todo/shared'
import {
    projectPreferenceEntityToRecord,
    projectPreferenceRecordToEntity
} from '../converters/preference'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'

/**
 * 本地项目偏好仓储实现
 * @description JSON 配置字段加密存储，按 projectId 查询
 */
export class LocalProjectPreferenceRepoImpl implements ProjectPreferenceRepository {
    constructor(private db: NaoTodoLocalDatabase = localDatabase) {}

    async getByProjectId(projectId: string): GoAsync<ProjectPreferenceEntity> {
        try {
            const record = await this.db.projectPreferences
                .where('projectId')
                .equals(projectId)
                .first()
            if (!record) return [null, '项目偏好不存在']
            return [await projectPreferenceRecordToEntity(record), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async save(updatedEntity: ProjectPreferenceEntity): GoAsync<void> {
        try {
            await this.db.projectPreferences.put(
                await projectPreferenceEntityToRecord(updatedEntity)
            )
            return null
        } catch (err) {
            return String(err)
        }
    }
}

/**
 * 创建本地项目偏好仓储实例
 */
export const newLocalProjectPreferenceRepository = () => new LocalProjectPreferenceRepoImpl()