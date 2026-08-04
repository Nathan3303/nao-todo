import {
    DeactiveUserValueObject,
    RestoreUserValueObject,
    UpdateUserNicknameValueObject,
    UpdateUserPasswordValueObject,
    UserEntity,
    UserRepository
} from '@nao-todo/domain-identity'
import type { GoAsync } from '@nao-todo/shared'
import { userEntityToRecord, userRecordToEntity } from '../converters/user'
import type { NaoTodoLocalDatabase } from '../db/local-database'
import { localDatabase } from '../db/local-database'

/**
 * 本地用户仓储实现
 * @description 桌面版单用户场景：users 表固定存 id='default' 一条资料。
 *              密码修改/注销等与远程认证绑定的操作在桌面版不支持，返回错误。
 */
export class LocalUserRepoImpl implements UserRepository {
    private static readonly LOCAL_USER_ID = 'default'

    constructor(private db: NaoTodoLocalDatabase = localDatabase) {}

    async getProfile(): GoAsync<UserEntity> {
        try {
            const record = await this.db.users.get(LocalUserRepoImpl.LOCAL_USER_ID)
            if (!record) return [null, '本地用户资料不存在']
            return [await userRecordToEntity(record), null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async updateNickname(updateVO: UpdateUserNicknameValueObject): GoAsync<void> {
        try {
            const record = await this.db.users.get(LocalUserRepoImpl.LOCAL_USER_ID)
            if (!record) return '本地用户资料不存在'
            const entity = await userRecordToEntity(record)
            entity.nickname = updateVO.nickname
            entity.updatedAt = new Date().toISOString()
            await this.db.users.put(await userEntityToRecord(entity))
            return null
        } catch (err) {
            return String(err)
        }
    }

    async updatePassword(_updateVO: UpdateUserPasswordValueObject): GoAsync<void> {
        return '桌面版暂不支持修改密码，请前往 Web 端操作'
    }

    async updateAvatarURL(url: string): GoAsync<string> {
        try {
            const record = await this.db.users.get(LocalUserRepoImpl.LOCAL_USER_ID)
            if (!record) return [null, '本地用户资料不存在']
            const entity = await userRecordToEntity(record)
            entity.avatar = url
            entity.updatedAt = new Date().toISOString()
            await this.db.users.put(await userEntityToRecord(entity))
            return [url, null]
        } catch (err) {
            return [null, String(err)]
        }
    }

    async updateAvatarFile(_file: File): GoAsync<string> {
        return [null, '桌面版暂不支持头像文件上传，请前往 Web 端操作']
    }

    async deactive(_deactiveVO: DeactiveUserValueObject): GoAsync<void> {
        return '桌面版暂不支持注销账号，请前往 Web 端操作'
    }

    async restore(_restoreVO: RestoreUserValueObject): GoAsync<void> {
        return '桌面版暂不支持恢复账号，请前往 Web 端操作'
    }
}

/**
 * 创建本地用户仓储实例
 */
export const newLocalUserRepository = () => new LocalUserRepoImpl()