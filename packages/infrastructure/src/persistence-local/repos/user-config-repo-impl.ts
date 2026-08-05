import type { UserConfigEntity } from '@nao-todo/domain-identity'
import { UserConfigRepository } from '@nao-todo/domain-identity'
import type { GoAsync } from '@nao-todo/shared'
import { userConfigEntityToRecord, userConfigRecordToEntity } from '../converters/user'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'
import { localSession } from '../session/local-session'

/**
 * 本地用户配置仓储实现
 * @description 桌面版单用户场景：userConfigs 表固定存 id='default' 一条
 */
export class LocalUserConfigRepoImpl implements UserConfigRepository {
    private static readonly LOCAL_CONFIG_ID = 'default'

    constructor(private db: NaoTodoLocalDatabase = localDatabase) {}

    /** 当前会话用户 ID（数据归属标识） */
    private get currentUserId(): string {
        return localSession.getCurrentUserId() ?? ''
    }

    async get(): GoAsync<UserConfigEntity> {
        try {
            const record = await this.db.userConfigs.get(LocalUserConfigRepoImpl.LOCAL_CONFIG_ID)
            if (!record || record.userId !== this.currentUserId) return [null, '本地用户配置不存在']
            return [userConfigRecordToEntity(record), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async save(updatedEntity: UserConfigEntity): GoAsync<void> {
        try {
            const record = userConfigEntityToRecord(updatedEntity, this.currentUserId)
            await this.db.userConfigs.put({
                ...record,
                id: LocalUserConfigRepoImpl.LOCAL_CONFIG_ID
            })
            return null
        } catch (err) {
            return String(err)
        }
    }
}

/**
 * 创建本地用户配置仓储实例
 */
export const newLocalUserConfigRepository = () => new LocalUserConfigRepoImpl()