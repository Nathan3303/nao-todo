import type { ProjectPreferenceEntity } from '@nao-todo/domain-project'
import { ProjectPreferenceRepository } from '@nao-todo/domain-project'
import type { GoAsync } from '@nao-todo/shared'
import {
    projectPreferenceEntityToRecord,
    projectPreferenceRecordToEntity
} from '../converters/preference'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'
import { localSession } from '../session/local-session'
import { defaultProjectPreferenceRes2Entity } from '../../persistence-go/project/converters'

/**
 * 本地项目偏好仓储实现
 * @description JSON 配置字段加密存储，按 projectId 查询
 */
export class LocalProjectPreferenceRepoImpl implements ProjectPreferenceRepository {
    constructor(private db: NaoTodoLocalDatabase = localDatabase) {}

    /** 当前会话用户 ID（数据归属标识） */
    private get currentUserId(): string {
        return localSession.getCurrentUserId() ?? ''
    }

    async getByProjectId(projectId: string): GoAsync<ProjectPreferenceEntity> {
        try {
            const record = await this.db.projectPreferences
                .where('projectId')
                .equals(projectId)
                .filter((r) => r.userId === this.currentUserId)
                .first()
            // 与远程行为一致：无偏好时返回默认偏好（viewType=table），不报错
            if (!record) return [defaultProjectPreferenceRes2Entity(projectId), null]
            return [await projectPreferenceRecordToEntity(record), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async save(updatedEntity: ProjectPreferenceEntity): GoAsync<void> {
        try {
            await this.db.projectPreferences.put(
                await projectPreferenceEntityToRecord(updatedEntity, this.currentUserId)
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